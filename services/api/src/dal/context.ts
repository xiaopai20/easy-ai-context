import {
  DynamoDBClient,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

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

export async function getNode(userId: string, path: string): Promise<{ path: string; content: string } | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk(userId), SK: sk(path) }),
      ConsistentRead: true,
    })
  );

  if (!result.Item) return null;
  const raw = unmarshall(result.Item) as Record<string, unknown>;

  return {
    path,
    content: String(raw.content || ''),
  };
}

export async function setNode(userId: string, path: string, content: string): Promise<void> {
  const nowIso = new Date().toISOString();

  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(
        {
          PK: pk(userId),
          SK: sk(path),
          content,
          updated_at: nowIso,
          GSI1_PK: gsi1Pk(userId),
          GSI1_SK: gsi1Sk(path),
        },
        { removeUndefinedValues: true }
      ),
    })
  );
}

export async function deleteNode(userId: string, path: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ PK: pk(userId), SK: sk(path) }),
    })
  );
}
