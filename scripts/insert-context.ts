#!/usr/bin/env npx tsx
/**
 * Insert example context nodes. Run with API in dev mode.
 * Usage: API_BASE_URL=http://localhost:3010 npx tsx scripts/insert-context.ts
 */

const API = process.env.API_BASE_URL || 'http://localhost:3010';

async function mcpCall(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${API}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: 1,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function main() {
  const entries = [
    { path: 'projects/easy-ai', content: 'hello' },
    { path: 'projects/easy-ai/notes', content: 'some notes' },
    { path: 'personal/preferences', content: 'prefers dark mode' },
  ];

  for (const e of entries) {
    const r = await mcpCall('context.set', e);
    console.log(`Set: ${e.path} (${JSON.stringify(r)})`);
  }
}

main().catch(console.error);

