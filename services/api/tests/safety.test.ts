import { describe, it } from 'node:test';
import assert from 'node:assert';
import { containsSecretPatterns, validateContentAndTags } from '../src/safety.js';

describe('containsSecretPatterns', () => {
  it('rejects AWS access key', () => {
    assert.strictEqual(containsSecretPatterns('Key: AKIA0123456789ABCDEF'), true);
  });

  it('rejects private key', () => {
    assert.strictEqual(containsSecretPatterns('-----BEGIN RSA PRIVATE KEY-----'), true);
  });

  it('rejects OpenAI secret key', () => {
    assert.strictEqual(containsSecretPatterns('sk-1234567890abcdefghij'), true);
  });

  it('rejects GitHub PAT', () => {
    assert.strictEqual(containsSecretPatterns('ghp_abcdefghijklmnopqrstuvwxyz1234567890'), true);
  });

  it('rejects api_key pattern', () => {
    assert.strictEqual(containsSecretPatterns('api_key: secret123'), true);
  });

  it('allows normal content', () => {
    assert.strictEqual(containsSecretPatterns('My project notes'), false);
  });
});

describe('validateContentAndTags', () => {
  it('rejects empty content', () => {
    assert.strictEqual(validateContentAndTags('').valid, false);
  });

  it('rejects content over 4k chars', () => {
    const long = 'a'.repeat(5000);
    assert.strictEqual(validateContentAndTags(long).valid, false);
  });

  it('accepts content exactly at 4096 chars', () => {
    const exactly = 'a'.repeat(4096);
    assert.strictEqual(validateContentAndTags(exactly).valid, true);
  });

  it('rejects content at 4097 chars', () => {
    const over = 'a'.repeat(4097);
    assert.strictEqual(validateContentAndTags(over).valid, false);
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    assert.strictEqual(validateContentAndTags('content', tags).valid, false);
  });

  it('accepts valid content and tags', () => {
    assert.strictEqual(validateContentAndTags('Hello', ['a', 'b']).valid, true);
  });

  it('accepts valid content with empty tags array', () => {
    assert.strictEqual(validateContentAndTags('Hello', []).valid, true);
  });

  it('returns error message for empty content', () => {
    const result = validateContentAndTags('');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error?.includes('required'));
  });
});
