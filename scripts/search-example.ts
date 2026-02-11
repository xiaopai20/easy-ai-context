#!/usr/bin/env npx tsx
/**
 * Run a small example flow. Run with API in dev mode.
 * Usage: API_BASE_URL=http://localhost:3010 npx tsx scripts/search-example.ts
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
  const path = 'projects/easy-ai';

  console.log(`Set: ${path}`);
  const r1 = await mcpCall('context.set', { path, content: 'hello' });
  console.log(JSON.stringify(r1, null, 2));

  console.log(`\nGet: ${path}`);
  const r2 = await mcpCall('context.get', { path });
  console.log(JSON.stringify(r2, null, 2));

  console.log('\nList: prefix="projects"');
  const r3 = await mcpCall('context.list_paths', { prefix: 'projects' });
  console.log(JSON.stringify(r3, null, 2));
}

main().catch(console.error);
