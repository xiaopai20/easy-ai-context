# Deploy to Production

## Prerequisites

1. **AWS CLI** configured with credentials (`aws configure` or env vars)
2. **CDK bootstrap** (one-time): `cd infra && npx cdk bootstrap`
3. **Prod config** (see below)

## Prod Configuration

Deploy prod with context or environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `ALLOWED_EMAILS` | Comma-separated emails allowed to use the API (empty = all) | Yes for prod |
| `callbackUrl` | OAuth callback URL (e.g. `https://your-app.com`) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional |

### Via context

```bash
cd infra
npx cdk deploy -c env=prod \
  -c allowedEmails=you@example.com \
  -c callbackUrl=https://your-app.com \
  -c googleClientId=YOUR_GOOGLE_CLIENT_ID \
  -c googleClientSecret=YOUR_GOOGLE_CLIENT_SECRET
```

### Via environment

```bash
export env=prod
export ALLOWED_EMAILS=you@example.com
export CALLBACK_URL=https://your-app.com
# Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
cd infra && npx cdk deploy
```

## Deploy Steps

1. Set prod env vars (required for `deploy:prod`):
   ```bash
   export ALLOWED_EMAILS=you@example.com
   export CALLBACK_URL=https://your-app.com
   ```

2. Deploy:
   ```bash
   npm run deploy:prod
   ```
   This builds the API and deploys the CDK stack. For dev: `npm run deploy:dev`.

   Or manually:
   ```bash
   npm run build
   cd infra && npx cdk deploy -c env=prod -c allowedEmails=... -c callbackUrl=...
   ```

3. After deploy, outputs include:
   - `ApiUrl` – API Gateway URL
   - `UserPoolId`, `UserPoolClientId` – Cognito IDs for frontend
   - `CognitoDomain` – for OAuth URLs

4. Add prod callback URL to Cognito User Pool Client (if using a different URL later):
   - AWS Console → Cognito → User Pool → App integration → Edit Hosted UI
   - Add your prod callback URL to "Allowed callback URLs"

## Post-deploy

- Register the prod callback URL in Cognito (done via CDK if passed at deploy time)
- Update Cursor MCP config / ChatGPT connector with prod API URL

## Testing the deployed Lambda

**Note:** The stack includes `http://localhost:3000` as an allowed OAuth callback so you can run `get-token.ts` locally. Redeploy if you deployed before this was added.

1. Get outputs from the stack:
   ```bash
  aws cloudformation describe-stacks --stack-name Context-prod --query 'Stacks[0].Outputs' --output table
   ```
   Note: `ApiUrl`, `CognitoDomain`, `UserPoolClientId`.

2. Get a Cognito ID token (localhost callback is allowed for testing). **Run from project root** (not infra):
   ```bash
  cd /path/to/easy-ai-context
  export COGNITO_DOMAIN=context-prod-xxx   # CognitoDomain from output (domain prefix)
   export CLIENT_ID=xxx                     # UserPoolClientId from output
   npx tsx scripts/get-token.ts
   ```
   Sign in via the browser (sign up first at the Hosted UI if needed); the script prints the `id_token`.

3. Call the API:
   ```bash
  export API_URL=https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com  # ApiUrl from output
   export TOKEN="<paste id_token from step 2>"

   curl -s "$API_URL/hello" -H "Authorization: Bearer $TOKEN"
   curl -s -X POST "$API_URL/mcp" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
   ```

4. Or use the test script:
   ```bash
   API_BASE_URL=$API_URL TOKEN=$TOKEN ./scripts/test-api.sh
   ```
