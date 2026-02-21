#!/bin/bash
# Test the MCP proxy directly (stdio transport), simulating what Cursor does.
#
# Usage (run from project root):
#   CONTEXT_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com \
#   CONTEXT_ACCESS_TOKEN=<cognito-id-token> \
#   ./scripts/test-proxy.sh
#
# Or source .env first:  source .env 2>/dev/null; ./scripts/test-proxy.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API="${CONTEXT_API_URL:-http://localhost:3010}"
TOKEN="${CONTEXT_ACCESS_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "Set CONTEXT_ACCESS_TOKEN (e.g. from scripts/get-token.ts)"
  echo "Example: CONTEXT_ACCESS_TOKEN=\$(npx tsx scripts/get-token.ts 2>/dev/null | tail -1) ./scripts/test-proxy.sh"
  exit 1
fi

echo "Testing proxy -> API at $API"
echo "Sending: initialize, tools/list, tools/call context_list_paths"
echo "---"

# Send JSON-RPC lines to proxy stdin; responses go to stdout
{
  echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
  echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"context_list_paths","arguments":{}},"id":3}'
} | CONTEXT_API_URL="$API" CONTEXT_ACCESS_TOKEN="$TOKEN" node --import "$ROOT/node_modules/tsx/dist/loader.mjs" "$ROOT/proxy/src/index.ts" 2>&1

echo "---"
echo "Done."
