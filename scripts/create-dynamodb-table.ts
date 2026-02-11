#!/usr/bin/env npx tsx
/**
 * Create DynamoDB table for local development (only if not exists).
 * Runs automatically via docker-compose init-db service on `docker compose up`.
 * To run manually: DYNAMODB_ENDPOINT=http://localhost:8010 npx tsx scripts/create-dynamodb-table.ts
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8010';
const tableName = process.env.TABLE_NAME || 'Context-dev';

const client = new DynamoDBClient({
  endpoint,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

async function waitForDynamoDB(maxAttempts = 40, delayMs = 1000): Promise<void> {
  // DynamoDB Local (Java) takes 5–15s to boot; wait before first attempt
  console.log('Waiting for DynamoDB Local to be ready...');
  await new Promise((r) => setTimeout(r, 8000));

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log('DynamoDB ready.');
      return;
    } catch (e) {
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw new Error('DynamoDB not ready after retries: ' + (e as Error).message);
      }
    }
  }
}

async function main() {
  await waitForDynamoDB();

  try {
    await client.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    console.log(`Table ${tableName} already exists.`);
    return;
  } catch {
    // Table doesn't exist, create it
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1_PK', AttributeType: 'S' },
        { AttributeName: 'GSI1_SK', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1_PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1_SK', KeyType: 'RANGE' },
          ],
          // Never project content. MVP: keys-only (add INCLUDE updated_at if desired later).
          Projection: { ProjectionType: 'KEYS_ONLY' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  console.log(`Created table ${tableName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
