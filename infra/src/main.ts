#!/usr/bin/env node
import 'source-map-support/register';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';
import { ContextStack } from './context-stack';

// Load env from infra/.env first, then repo root .env as fallback
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

new ContextStack(app, `Context-${env}`, {
  env: {
    account,
    region,
  },
  description: `Context - ${env} environment`,
  tags: {
    Environment: env,
    Project: 'Context',
  },
});
