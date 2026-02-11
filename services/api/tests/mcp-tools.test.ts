import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getToolSchemas } from '../src/mcp/router.js';

describe('getToolSchemas', () => {
  it('returns tools with required MCP annotations (readOnlyHint, openWorldHint, destructiveHint)', () => {
    const tools = getToolSchemas();
    const readOnlyTools = ['context.list_paths', 'context.get'];
    const destructiveTools = ['context.delete'];
    const writeTools = ['context.set'];

    for (const t of tools) {
      assert.ok(t.annotations, `${t.name} must have annotations`);
      assert.strictEqual(typeof t.annotations!.readOnlyHint, 'boolean', `${t.name}: readOnlyHint required`);
      assert.strictEqual(typeof t.annotations!.openWorldHint, 'boolean', `${t.name}: openWorldHint required`);
      assert.strictEqual(typeof t.annotations!.destructiveHint, 'boolean', `${t.name}: destructiveHint required`);

      if (readOnlyTools.includes(t.name)) {
        assert.strictEqual(t.annotations!.readOnlyHint, true, `${t.name} should be readOnly`);
        assert.strictEqual(t.annotations!.destructiveHint, false, `${t.name} should not be destructive`);
      }
      if (destructiveTools.includes(t.name)) {
        assert.strictEqual(t.annotations!.destructiveHint, true, `${t.name} should be destructive`);
      }
      if (writeTools.includes(t.name)) {
        assert.strictEqual(t.annotations!.readOnlyHint, false, `${t.name} should not be readOnly`);
        assert.strictEqual(t.annotations!.destructiveHint, false, `${t.name} should not be destructive`);
      }
    }
  });

  it('returns tools with _meta.ui.visibility for ChatGPT', () => {
    const tools = getToolSchemas();
    for (const t of tools) {
      const meta = t._meta as { ui?: { visibility?: string[] } } | undefined;
      assert.ok(meta, `${t.name} must have _meta`);
      assert.ok(meta.ui, `${t.name} must have _meta.ui`);
      assert.ok(Array.isArray(meta.ui.visibility), `${t.name} must have _meta.ui.visibility array`);
      assert.ok(meta.ui.visibility!.includes('model'), `${t.name} _meta.ui.visibility must include 'model'`);
    }
  });

  it('returns exactly 4 context tools', () => {
    const tools = getToolSchemas();
    const names = tools.map((t) => t.name);
    assert.deepStrictEqual(names.sort(), [
      'context.delete',
      'context.get',
      'context.list_paths',
      'context.set',
    ]);
  });
});
