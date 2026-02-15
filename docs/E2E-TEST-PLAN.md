# End-to-End Test Plan

## 1. Local Unit Tests

```bash
cd services/api
npm run test:unit
```

Tests:
- `tests/scope-utils.test.ts` - scope validation, expandScopes, isChildOf
- `tests/safety.test.ts` - secret patterns, content validation
- `tests/rankers.test.ts` - LexicalRanker on fixture data
- `tests/dal/context.test.ts` - SK format

## 2. Local Integration (Docker)

```bash
# Terminal 1
docker-compose up

# Terminal 2 (wait ~30s)
cd services/api
API_BASE_URL=http://localhost:3010 npm run test:integration
```

## 3. Deployed Smoke Tests (curl)

After `cd infra && cdk deploy`:

```bash
# Get API URL from stack output
API_URL=$(aws cloudformation describe-stacks --stack-name Context-dev --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)

# Get Cognito token (use OAuth flow or aws cognito-idp admin-initiate-auth)
# For smoke test, paste token:
TOKEN="your-cognito-access-token"

# Health
curl -s "$API_URL/hello" -H "Authorization: Bearer $TOKEN"

# List tools
curl -s -X POST "$API_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

## 4. ChatGPT Connector Test Steps

1. Create Cognito User Pool with OAuth (authorization code + PKCE).
2. Create App Client with callback URL for ChatGPT MCP.
3. Deploy API.
4. Configure ChatGPT MCP connector with API URL and OAuth credentials.
5. Test: list_paths, set, get, delete.

## 5. Cursor Integration Steps

1. Build proxy: `cd proxy && npm run build`
2. Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "context": {
      "command": "npx",
      "args": ["tsx", "proxy/src/index.ts"],
      "cwd": "/path/to/easy-ai-context",
      "env": {
        "CONTEXT_API_URL": "http://localhost:3010"
      }
    }
  }
}
```

3. Restart Cursor.
4. In chat, use tools: context_list_paths, context_set, etc.

## 6. Example Data Scripts

```bash
# Insert context
API_BASE_URL=http://localhost:3010 npx tsx scripts/insert-context.ts

# Run example flow
API_BASE_URL=http://localhost:3010 npx tsx scripts/search-example.ts
```
