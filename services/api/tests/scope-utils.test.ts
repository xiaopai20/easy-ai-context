import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateScopeId, expandScopes, isChildOf } from '@context/shared';

describe('validateScopeId', () => {
  it('rejects empty scope', () => {
    assert.strictEqual(validateScopeId('').valid, false);
    assert.strictEqual(validateScopeId('   ').valid, false);
  });

  it('accepts valid scopes', () => {
    assert.strictEqual(validateScopeId('personal').valid, true);
    assert.strictEqual(validateScopeId('project:ai-context').valid, true);
    assert.strictEqual(validateScopeId('project:ai-context:infra').valid, true);
  });

  it('accepts underscore and hyphen', () => {
    assert.strictEqual(validateScopeId('my_project').valid, true);
    assert.strictEqual(validateScopeId('my-scope').valid, true);
    assert.strictEqual(validateScopeId('a:b_c-d').valid, true);
  });

  it('rejects invalid chars', () => {
    assert.strictEqual(validateScopeId('Project').valid, false);
    assert.strictEqual(validateScopeId('scope@test').valid, false);
  });

  it('rejects scope depth over 10', () => {
    const deep = 'a:b:c:d:e:f:g:h:i:j:k';
    assert.strictEqual(validateScopeId(deep).valid, false);
  });
});

describe('isChildOf', () => {
  it('same scope is child', () => {
    assert.strictEqual(isChildOf('project:a', 'project:a'), true);
  });

  it('child scope is child', () => {
    assert.strictEqual(isChildOf('project:a:b', 'project:a'), true);
  });

  it('parent scope is not child of child', () => {
    assert.strictEqual(isChildOf('project:a', 'project:a:b'), false);
  });

  it('empty parentScope returns true', () => {
    assert.strictEqual(isChildOf('any', ''), true);
  });

  it('similar names do not collide', () => {
    assert.strictEqual(isChildOf('project:ab', 'project:a'), false); // project:ab is NOT a child of project:a
    assert.strictEqual(isChildOf('project:a', 'project:ab'), false);
  });
});

describe('expandScopes', () => {
  it('parent includes children', () => {
    const all = ['project:a', 'project:a:b', 'project:a:b:c'];
    const result = expandScopes(all, 'project:a', true, 50);
    assert.deepStrictEqual(result, ['project:a', 'project:a:b', 'project:a:b:c']);
  });

  it('includeChildren=false returns only exact match', () => {
    const all = ['project:a', 'project:a:b', 'project:a:b:c'];
    const result = expandScopes(all, 'project:a', false, 50);
    assert.deepStrictEqual(result, ['project:a']);
  });

  it('similar names do not collide', () => {
    const all = ['project:a', 'project:ab', 'project:a:b'];
    const result = expandScopes(all, 'project:a', true, 50);
    assert.deepStrictEqual(result, ['project:a', 'project:a:b']);
  });

  it('throws when too many scopes', () => {
    const all = Array.from({ length: 60 }, (_, i) => `project:${i}`);
    assert.throws(() => expandScopes(all, 'project', true, 50));
  });
});
