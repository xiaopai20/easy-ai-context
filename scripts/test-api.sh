#!/bin/bash
# Test API endpoints.
# Local (dev mode, no auth): API_BASE_URL=http://localhost:3010 ./scripts/test-api.sh
# Deployed (with token): API_BASE_URL=https://xxx.execute-api.us-east-1.amazonaws.com TOKEN=xxx ./scripts/test-api.sh

API="${API_BASE_URL:-http://localhost:3010}"
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")

echo "Testing API at $API"
echo ""

echo "1. GET /hello"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" "$API/hello"
echo -e "\n"

echo "2. POST /mcp - initialize (MCP handshake)"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":0}'
echo -e "\n"

echo "3. POST /mcp - notifications/initialized"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
echo -e "\n"

echo "4. POST /mcp - tools/list (ChatGPT-like headers: Accept: application/json, text/event-stream)"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
echo -e "\n"

echo "5. POST /mcp - tools/call context.list_paths"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"context.list_paths","arguments":{}},"id":1}'
echo -e "\n"

echo "6. POST /mcp - tools/call context.set"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"context.set","arguments":{"path":"projects/easy-ai","content":"hello"}},"id":2}'
echo -e "\n"

echo "7. POST /mcp - tools/call context.get"
curl -s -w "\n[HTTP %{http_code}]" "${AUTH[@]}" -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"context.get","arguments":{"path":"projects/easy-ai"}},"id":3}'
echo -e "\n"

echo "Done."
