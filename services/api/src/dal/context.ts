import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export const CONTEXT_CONFLICT = 'CONTEXT_CONFLICT';
export const CONTEXT_PARENT_REQUIRED = 'CONTEXT_PARENT_REQUIRED';

const client = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
  region: process.env.AWS_REGION || 'us-east-1',
});

const TABLE_NAME = process.env.TABLE_NAME || 'Context-dev';

function pk(userId: string): string {
  return `USER#${userId}#CONTEXT`;
}

function sk(path: string): string {
  return `PATH#${path}`;
}

function gsi1Pk(userId: string): string {
  return `USER#${userId}`;
}

function gsi1Sk(path: string): string {
  return `PATH#${path}`;
}

export async function listPaths(userId: string, prefix?: string): Promise<string[]> {
  // No prefix: list everything for the user (via GSI).
  if (!prefix) {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1_PK = :gsi1pk',
        ExpressionAttributeValues: marshall({ ':gsi1pk': gsi1Pk(userId) }),
        ScanIndexForward: true,
      })
    );

    const rawItems = (result.Items || []).map((i) => unmarshall(i) as Record<string, unknown>);
    return rawItems
      .map((it) => String(it.GSI1_SK || ''))
      .filter((v) => v.startsWith('PATH#'))
      .map((v) => v.slice('PATH#'.length));
  }

  // With prefix: query descendants only (PATH#{prefix}/...), then include prefix itself only if it exists.
  // This avoids sibling collisions (e.g. prefix=proj matching projects).
  const descendantsResult = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1_PK = :gsi1pk AND begins_with(GSI1_SK, :pfxChild)',
      ExpressionAttributeValues: marshall({
        ':gsi1pk': gsi1Pk(userId),
        ':pfxChild': gsi1Sk(`${prefix}/`),
      }),
      ScanIndexForward: true,
    })
  );

  const descendantItems = (descendantsResult.Items || []).map((i) => unmarshall(i) as Record<string, unknown>);
  const paths = descendantItems
    .map((it) => String(it.GSI1_SK || ''))
    .filter((v) => v.startsWith('PATH#'))
    .map((v) => v.slice('PATH#'.length));

  // Check if the prefix node itself exists without reading content.
  const prefixExists = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk(userId), SK: sk(prefix) }),
      ProjectionExpression: 'PK, SK',
    })
  );

  return prefixExists.Item ? [prefix, ...paths] : paths;
}

export interface ContextNode {
  path: string;
  content: string;
  /** ISO timestamp; use as ifMatchVersion when updating. Null when node does not exist. */
  version: string | null;
}

export async function getNode(userId: string, path: string): Promise<ContextNode | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk(userId), SK: sk(path) }),
      ConsistentRead: true,
    })
  );

  if (!result.Item) return null;
  const raw = unmarshall(result.Item) as Record<string, unknown>;
  const updatedAt = raw.updated_at;
  return {
    path,
    content: String(raw.content || ''),
    version: typeof updatedAt === 'string' ? updatedAt : null,
  };
}

export interface SetNodeOptions {
  /**
   * For update: must match current node's version (from context_get).
   * For create: omit or pass null/empty so the write is create-only.
   */
  ifMatchVersion?: string | null;
  /** Required when path has a parent (contains '/'); updated parent roll-up written in same transaction. */
  parentSummary?: string;
}

function getParentPath(path: string): string | null {
  const i = path.lastIndexOf('/');
  return i < 0 ? null : path.slice(0, i);
}

export async function setNode(
  userId: string,
  path: string,
  content: string,
  options?: SetNodeOptions
): Promise<void> {
  const nowIso = new Date().toISOString();
  const parentPath = getParentPath(path);
  const parentSummary = options?.parentSummary;
  if (parentPath !== null && (parentSummary === undefined || parentSummary === null)) {
    throw new Error(
      `${CONTEXT_PARENT_REQUIRED}: Updating a child path requires parentSummary (updated roll-up for parent "${parentPath}").`
    );
  }
  if (parentPath === null && parentSummary != null) {
    throw new Error('parentSummary must not be set when path has no parent (root-level path).');
  }

  const isUpdate = options?.ifMatchVersion != null && String(options.ifMatchVersion).trim() !== '';
  const childItem = {
    PK: pk(userId),
    SK: sk(path),
    content,
    updated_at: nowIso,
    GSI1_PK: gsi1Pk(userId),
    GSI1_SK: gsi1Sk(path),
  };

  const runPut = async (): Promise<void> => {
    if (parentPath != null && parentSummary != null) {
      const parentItem = {
        PK: pk(userId),
        SK: sk(parentPath),
        content: parentSummary,
        updated_at: nowIso,
        GSI1_PK: gsi1Pk(userId),
        GSI1_SK: gsi1Sk(parentPath),
      };
      const childPut = {
        TableName: TABLE_NAME,
        Item: marshall(childItem, { removeUndefinedValues: true }),
        ...(isUpdate
          ? {
              ConditionExpression: 'updated_at = :v',
              ExpressionAttributeValues: marshall({ ':v': options!.ifMatchVersion! }),
            }
          : { ConditionExpression: 'attribute_not_exists(SK)' as const }),
      };
      await client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            { Put: childPut },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: marshall(parentItem, { removeUndefinedValues: true }),
              },
            },
          ],
        })
      );
      return;
    }
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(childItem, { removeUndefinedValues: true }),
        ...(isUpdate
          ? {
              ConditionExpression: 'updated_at = :v',
              ExpressionAttributeValues: marshall({ ':v': options!.ifMatchVersion! }),
            }
          : { ConditionExpression: 'attribute_not_exists(SK)' }),
      })
    );
  };

  try {
    await runPut();
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      const msg = isUpdate
        ? 'Node was modified since read or does not exist. Re-read with context_get and use the returned version in context_set.'
        : 'Node already exists. Use context_get and pass the returned version in context_set to update.';
      const e = new Error(msg) as Error & { code?: string };
      e.code = CONTEXT_CONFLICT;
      throw e;
    }
    throw err;
  }
}

export async function deleteNode(userId: string, path: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk(userId), SK: sk(path) }),
    })
  );
}
