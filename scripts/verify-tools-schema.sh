#!/bin/bash
# Verify tools/list returns correct MCP annotations and _meta for ChatGPT.
# Local (dev mode): API_BASE_URL=http://localhost:3010 ./scripts/verify-tools-schema.sh
# Deployed: API_BASE_URL=https://xxx.execute-api.us-east-1.amazonaws.com TOKEN=xxx ./scripts/verify-tools-schema.sh

API="${API_BASE_URL:-http://localhost:3010}"
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")

echo "Verifying tools schema at $API"
echo ""

# Use ChatGPT-like headers (Streamable HTTP spec)
CURL_HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

RESP=$(curl -s "${AUTH[@]}" "${CURL_HEADERS[@]}" -X POST "$API/mcp" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}')

# Extract first tool for inspection
FIRST_TOOL=$(echo "$RESP" | jq -r '.result.tools[0] // empty')
if [ -z "$FIRST_TOOL" ]; then
  echo "ERROR: No tools in response. Full response:"
  echo "$RESP" | jq .
  exit 1
fi

echo "Sample tool (context.list_paths):"
echo "$RESP" | jq '.result.tools[0]'
echo ""

# Check required fields
ERRORS=0

check_field() {
  local tool_idx=$1
  local field=$2
  local expected=$3
  local actual=$(echo "$RESP" | jq -r ".result.tools[$tool_idx].$field // \"MISSING\"")
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: tools[$tool_idx].$field expected '$expected', got '$actual'"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK:   tools[$tool_idx].$field = $actual"
  fi
}

echo "Verifying annotations (readOnlyHint, openWorldHint, destructiveHint):"
for i in 0 1 2 3; do
  name=$(echo "$RESP" | jq -r ".result.tools[$i].name")
  readOnly=$(echo "$RESP" | jq -r ".result.tools[$i].annotations.readOnlyHint | if . == null then \"MISSING\" else . end")
  destructive=$(echo "$RESP" | jq -r ".result.tools[$i].annotations.destructiveHint | if . == null then \"MISSING\" else . end")
  echo "  $name: readOnlyHint=$readOnly, destructiveHint=$destructive"
  if [ "$readOnly" = "MISSING" ] || [ "$destructive" = "MISSING" ]; then
    echo "    FAIL: missing required annotations"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

echo "Verifying _meta.ui.visibility:"
for i in 0 1 2 3; do
  name=$(echo "$RESP" | jq -r ".result.tools[$i].name")
  visibility=$(echo "$RESP" | jq -r '.result.tools['"$i"']._meta.ui.visibility | if . == null then "MISSING" else join(",") end')
  echo "  $name: visibility=$visibility"
  if [ "$visibility" = "MISSING" ] || ! echo "$visibility" | grep -q "model"; then
    echo "    FAIL: _meta.ui.visibility should include 'model'"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "Verification FAILED ($ERRORS errors)"
  exit 1
fi

echo "All checks passed."
