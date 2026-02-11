#!/bin/bash
# Verify 401/403 responses include WWW-Authenticate (so ChatGPT can restart OAuth).
# Usage: API_BASE_URL=https://xxx.execute-api.us-east-1.amazonaws.com ./scripts/verify-401-www-auth.sh

API="${API_BASE_URL:-http://localhost:3010}"

echo "Verifying 401 includes WWW-Authenticate at $API"
echo ""

# No auth - expect 401
RESP=$(curl -s -i -X POST "$API/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')

STATUS=$(echo "$RESP" | head -1 | awk '{print $2}')
# Extract header line (curl returns "www-authenticate: Bearer realm=...")
WWW_AUTH_LINE=$(echo "$RESP" | grep -i "WWW-Authenticate:" | head -1)
# Value is everything after first ": " (header name + ": " + value)
WWW_AUTH_VALUE="${WWW_AUTH_LINE#*: }"

echo "Status: $STATUS"
echo "WWW-Authenticate value: $WWW_AUTH_VALUE"
echo ""

if [ "$STATUS" != "401" ]; then
  echo "WARN: Expected 401 without auth, got $STATUS"
fi

if [ -z "$WWW_AUTH_LINE" ]; then
  echo "FAIL: No WWW-Authenticate header. ChatGPT needs this to restart OAuth on 401."
  exit 1
fi

# Value must start with "Bearer" (not "www-authenticate: Bearer" - that would be malformed)
if [[ "$WWW_AUTH_VALUE" != Bearer* ]]; then
  echo "FAIL: WWW-Authenticate value must start with 'Bearer', got: ${WWW_AUTH_VALUE:0:50}..."
  exit 1
fi

if ! echo "$WWW_AUTH_VALUE" | grep -q 'resource_metadata'; then
  echo "FAIL: WWW-Authenticate should include resource_metadata for OAuth discovery"
  exit 1
fi

echo "OK: 401 includes WWW-Authenticate with Bearer and resource_metadata"
