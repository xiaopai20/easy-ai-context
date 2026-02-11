# Cursor MCP Configuration for Personal Context Service

## Status note (Cursor)

Cursor integration is **not tested yet** in this repo.

Known caveat: on very new Node versions (e.g. Node 25), `npx tsx ...` can fail due to a broken `node_modules/.bin/tsx` shim. If that happens, use the “Alternative command” snippets below or switch to Node 20/22 LTS.

## Option A: Local API (Dev Mode)

When running `docker-compose up`, the API is at `http://localhost:3010` and auth is bypassed.

Add to Cursor's MCP config (e.g. `~/.cursor/mcp.json` or project `.cursor/mcp.json`):

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

### Option A — Alternative command (if `npx tsx` is broken)

Use Node’s `--import tsx` instead of the `tsx` shim:

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["--import", "tsx", "proxy/src/index.ts"],
      "cwd": "/path/to/easy-ai-context",
      "env": {
        "CONTEXT_API_URL": "http://localhost:3010"
      }
    }
  }
}
```

## Option B: Deployed API with Cognito Token

1. Get a Cognito access token (from OAuth flow or AWS CLI).
2. Set `CONTEXT_ACCESS_TOKEN` in the env:

```json
{
  "mcpServers": {
    "context": {
      "command": "npx",
      "args": ["tsx", "proxy/src/index.ts"],
      "cwd": "/path/to/easy-ai-context",
      "env": {
        "CONTEXT_API_URL": "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com",
        "CONTEXT_ACCESS_TOKEN": "YOUR_COGNITO_ACCESS_TOKEN"
      }
    }
  }
}
```

### Option B — Alternative command (if `npx tsx` is broken)

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["--import", "tsx", "proxy/src/index.ts"],
      "cwd": "/path/to/easy-ai-context",
      "env": {
        "CONTEXT_API_URL": "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com",
        "CONTEXT_ACCESS_TOKEN": "YOUR_COGNITO_ACCESS_TOKEN"
      }
    }
  }
}
```

## Option C: Direct URL with OAuth (Cursor connects to API directly)

Use Cursor's built-in OAuth for the deployed API. **Important: use the Cognito User Pool Client ID, NOT the Google client ID.**

```json
{
  "mcpServers": {
    "context": {
      "url": "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/mcp",
      "auth": {
        "CLIENT_ID": "YOUR_COGNITO_USER_POOL_CLIENT_ID",
        "CLIENT_SECRET": "",
        "scopes": ["openid", "email", "profile"]
      }
    }
  }
}
```

Get `CLIENT_ID` from CDK output: `UserPoolClientId` (e.g. `1a2b3c4d5e6f7g8h9i0j`). Do **not** use `GOOGLE_CLIENT_ID` here—that is only for the Cognito Google Identity Provider.

After deploy, Cognito callback URLs include `cursor://anysphere.cursor-mcp/oauth/callback` and `cursor://anysphere.cursor-mcp/oauth/context/callback`. Redeploy if you added OAuth before these were in the stack.

## ChatGPT MCP Connector

See [mcp-chatgpt-config.md](mcp-chatgpt-config.md) for full setup (developer mode, connector URL, OAuth with Cognito).

## Cursor / OpenClaw OAuth Callbacks

The Cognito stack includes callback URLs for Cursor (`cursor://anysphere.cursor-mcp/oauth/callback`, `cursor://anysphere.cursor-mcp/oauth/context/callback`) and OpenClaw (`http://127.0.0.1:1455/auth/callback`).

## Token Refresh

Tokens expire. For long-running use, implement a device-code or refresh flow and update `CONTEXT_ACCESS_TOKEN` periodically.
