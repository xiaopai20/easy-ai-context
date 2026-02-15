# Cursor MCP Configuration for Personal Context Service

## Status

Verified working: stdio proxy with Cognito token. On Node 25, `npx tsx` may fail—use the alternative `node --import tsx` command below.

## Configuration

Add to `~/.cursor/mcp.json` or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "personal-context": {
      "command": "npx",
      "args": ["tsx", "path/to/easy-ai-context/proxy/src/index.ts"],
      "env": {
        "CONTEXT_API_URL": "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com",
        "CONTEXT_ACCESS_TOKEN": "YOUR_COGNITO_ACCESS_TOKEN"
      }
    }
  }
}
```

Replace `path/to/easy-ai-context` with your project path (e.g. `projects/easy-ai-context`). Tokens expire ~1 hour; refresh with `scripts/get-token.ts` or AWS CLI.

### Alternative command (if `npx tsx` is broken on Node 25)

```json
{
  "mcpServers": {
    "personal-context": {
      "command": "node",
      "args": ["--import", "tsx", "path/to/easy-ai-context/proxy/src/index.ts"],
      "env": {
        "CONTEXT_API_URL": "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com",
        "CONTEXT_ACCESS_TOKEN": "YOUR_COGNITO_ACCESS_TOKEN"
      }
    }
  }
}
```

## ChatGPT MCP Connector

See [mcp-chatgpt-config.md](mcp-chatgpt-config.md) for full setup (developer mode, connector URL, OAuth with Cognito).
