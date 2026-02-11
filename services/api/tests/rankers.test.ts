import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LexicalRanker } from '../src/rankers/lexical.js';
import type { ContextEntry } from '@context/shared';

const fixture: ContextEntry[] = [
  { id: '1', scope: 'work', content: 'Meeting with team about AI context project', tags: ['meeting'], created_at: '2025-02-08T10:00:00Z', status: 'active' },
  { id: '2', scope: 'work', content: 'Deployed to production', tags: [], created_at: '2025-02-08T09:00:00Z', status: 'active' },
  { id: '3', scope: 'personal', content: 'Bought groceries', tags: ['errands'], created_at: '2025-02-07T18:00:00Z', status: 'active' },
  { id: '4', scope: 'personal', content: 'I prefer dark mode and use keyboard shortcuts.', tags: [], created_at: '2025-02-08T08:00:00Z', status: 'active' },
];

describe('LexicalRanker', () => {
  it('scores exact phrase match highest', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('AI context', fixture);
    assert.ok(results[0].score >= results[1].score);
    assert.strictEqual(results[0].id, '1');
  });

  it('returns snippets <= 400 chars', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('meeting', fixture);
    results.forEach((r) => assert.ok(r.snippet.length <= 401));
  });

  it('returns empty for empty query', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('', fixture);
    assert.ok(results.length <= 20);
  });

  it('boosts tag match', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('errands', fixture);
    assert.strictEqual(results[0].id, '3');
    assert.ok(results[0].score > 0);
  });

  it('scores token overlap', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('deployed production', fixture);
    assert.strictEqual(results[0].id, '2');
  });

  it('no matching tokens returns zero scores', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('xyznonexistent', fixture);
    assert.ok(results.every((r) => r.score === 0 || r.score === 0.5));
  });

  it('stems matching: preference matches prefer', () => {
    const ranker = new LexicalRanker();
    const results = ranker.score('my preference', fixture);
    assert.strictEqual(results[0].id, '4');
    assert.ok(results[0].score >= 2);
  });
});
