import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './helpers';

async function toolsCall<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const body = await apiRequest<{ result?: { content?: Array<{ type: string; text: string }>; isError?: boolean }; error?: unknown }>(
    '/mcp',
    {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name, arguments: args },
        id: 1,
      }),
    }
  );

  if ((body as any).error) {
    throw new Error(`MCP error: ${JSON.stringify((body as any).error)}`);
  }

  const text = body.result?.content?.[0]?.text ?? '{}';
  return JSON.parse(text) as T;
}

test('integration: set/get/list_paths/delete flow', async () => {
  const path = 'projects/easy-ai';

  const setRes = await toolsCall<{ ok: true }>('context_set', { path, content: 'hello' });
  assert.equal(setRes.ok, true);

  const getRes1 = await toolsCall<{ path: string; content: string }>('context_get', { path });
  assert.equal(getRes1.path, path);
  assert.equal(getRes1.content, 'hello');

  const listRes = await toolsCall<{ paths: string[] }>('context_list_paths', { prefix: 'projects' });
  assert.ok(Array.isArray(listRes.paths));
  assert.ok(listRes.paths.includes(path));

  const delRes = await toolsCall<{ ok: true }>('context_delete', { path });
  assert.equal(delRes.ok, true);

  const getRes2 = await toolsCall<{ path: string; content: string }>('context_get', { path });
  assert.equal(getRes2.path, path);
  assert.equal(getRes2.content, '');
});

