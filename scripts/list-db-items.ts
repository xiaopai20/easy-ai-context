#!/usr/bin/env npx tsx
/**
 * List items in the local DynamoDB table.
 * Usage: DYNAMODB_ENDPOINT=http://localhost:8010 npx tsx scripts/list-db-items.ts
 *
 * When using docker-compose: DynamoDB runs on host port 8010.
 */

import {
  DynamoDBClient,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

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

async function main() {
  const result = await client.send(
    new ScanCommand({
      TableName: tableName,
      Limit: 100,
    })
  );

  const items = (result.Items || []).map((i) => unmarshall(i));
  console.log(`Table: ${tableName} (${items.length} items)\n`);
  if (items.length === 0) {
    console.log('No items. Run context.set then context.list_paths via API, or:');
    console.log('  API_BASE_URL=http://localhost:3010 npx tsx scripts/insert-context.ts');
    return;
  }
  items.forEach((item, i) => {
    console.log(`[${i + 1}] PK=${item.PK} SK=${item.SK}`);
    if (item.GSI1_PK) console.log(`    GSI1_PK: ${item.GSI1_PK}`);
    if (item.GSI1_SK) console.log(`    GSI1_SK: ${item.GSI1_SK}`);
    if (item.content) console.log(`    content: ${String(item.content).slice(0, 60)}...`);
    if (item.updated_at) console.log(`    updated_at: ${item.updated_at}`);
    console.log('');
  });
}

main().catch((err) => {
  console.error(err.message);
  if (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED')) {
    console.error('\nIs DynamoDB Local running? Try: docker compose up -d dynamodb-local');
  }
  process.exit(1);
});
