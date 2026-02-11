#!/bin/bash
# Verify CORS preflight (OPTIONS) and oauth-protected-resource for ChatGPT.
# Usage: API_BASE_URL=https://xxx.execute-api.us-east-1.amazonaws.com ./scripts/verify-cors.sh

API="${API_BASE_URL:-http://localhost:3010}"

echo "Verifying CORS and OAuth discovery at $API"
echo ""

# 1. OPTIONS /mcp (CORS preflight - ChatGPT browser sends this)
echo "1. OPTIONS /mcp (CORS preflight)"
OPTIONS_RESP=$(curl -s -i -X OPTIONS "$API/mcp" \
  -H "Origin: https://chatgpt.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,accept,mcp-protocol-version")

OPTIONS_STATUS=$(echo "$OPTIONS_RESP" | head -1 | awk '{print $2}')
ACAO=$(echo "$OPTIONS_RESP" | grep -i "Access-Control-Allow-Origin:" | head -1)
ACAM=$(echo "$OPTIONS_RESP" | grep -i "Access-Control-Allow-Methods:" | head -1)

echo "   Status: $OPTIONS_STATUS"
echo "   $ACAO"
echo "   $ACAM"

if [ "$OPTIONS_STATUS" != "200" ] && [ "$OPTIONS_STATUS" != "204" ]; then
  echo "   FAIL: OPTIONS should return 200 or 204"
  exit 1
fi
if ! echo "$OPTIONS_RESP" | grep -qi "Access-Control-Allow-Origin"; then
  echo "   FAIL: Missing Access-Control-Allow-Origin"
  exit 1
fi
echo "   OK"
echo ""

# 2. GET /.well-known/oauth-protected-resource (no auth, for OAuth discovery)
echo "2. GET /.well-known/oauth-protected-resource"
OAUTH_RESP=$(curl -s -i "$API/.well-known/oauth-protected-resource")
OAUTH_STATUS=$(echo "$OAUTH_RESP" | head -1 | awk '{print $2}')
OAUTH_BODY=$(echo "$OAUTH_RESP" | sed -n '/^\r$/,$p' | tail -n +2)

echo "   Status: $OAUTH_STATUS"
if [ "$OAUTH_STATUS" != "200" ]; then
  echo "   FAIL: Should be 200, no auth required"
  exit 1
fi
if ! echo "$OAUTH_BODY" | grep -q "authorization_servers"; then
  echo "   FAIL: Response should include authorization_servers"
  exit 1
fi
echo "   OK"
echo ""

echo "All CORS and OAuth discovery checks passed."
