# ChatGPT MCP Connector – Personal Context Service

Add your deployed Context API to ChatGPT so you can use `context.list_paths`, `context.get`, `context.set`, etc. from ChatGPT.

## Prerequisites

- **ChatGPT plan**: Business, Enterprise, or Edu (full MCP). Pro supports read-only tools.
- **Developer mode**: Enable in **Settings → Apps & Connectors → Advanced settings**.
- **Prod API**: Deployed and reachable at `https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com` (or your `ApiUrl` output).

## Setup (OAuth)

ChatGPT connects via OAuth (Cognito). Follow these steps.

### 1) Create the connector in ChatGPT (OAuth)

1. Go to **Settings → Connectors → Create**.
2. Fill in:
   - **Connector name**: `Personal Context`
   - **Description**: `This server stores a user’s long-term context as a hierarchical tree of paths. Each path contains a single curated “living summary” string.`
   - **Connector URL**: `https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/mcp`
3. In the **Authentication** section, choose **OAuth 2.0** and fill in:
   - **Authorization URL**: `https://YOUR_COGNITO_DOMAIN.auth.YOUR_REGION.amazoncognito.com/oauth2/authorize`
   - **Token URL**: `https://YOUR_COGNITO_DOMAIN.auth.YOUR_REGION.amazoncognito.com/oauth2/token`
   - **Client ID**: your Cognito User Pool Client ID (stack output `UserPoolClientId`)
   - **Client secret**: leave blank if using a public client; otherwise use the app client secret if configured.
   - **Scopes**: `openid email profile`

4. Create the connector and test.
