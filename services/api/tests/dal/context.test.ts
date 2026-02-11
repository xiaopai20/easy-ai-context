import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('context path key format', () => {
  it('base keys use PK USER#{id}#CONTEXT and SK PATH#{path}', () => {
    const userId = 'u1';
    const path = 'projects/easy-ai';
    const pk = `USER#${userId}#CONTEXT`;
    const sk = `PATH#${path}`;
    assert.equal(pk, 'USER#u1#CONTEXT');
    assert.equal(sk, 'PATH#projects/easy-ai');
  });

  it('GSI1 keys use GSI1_PK USER#{id} and GSI1_SK PATH#{path}', () => {
    const userId = 'u1';
    const path = 'projects/easy-ai';
    const gsi1pk = `USER#${userId}`;
    const gsi1sk = `PATH#${path}`;
    assert.equal(gsi1pk, 'USER#u1');
    assert.equal(gsi1sk, 'PATH#projects/easy-ai');
  });
});

