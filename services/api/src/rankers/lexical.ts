import { stemmer } from 'stemmer';
import type { ContextEntry } from '@context/shared';
import { MAX_SNIPPET_LENGTH } from '@context/shared';

export interface RankedResult {
  id: string;
  scope: string;
  score: number;
  snippet: string;
  created_at: string;
  source_tool?: string;
}

export interface Ranker {
  score(query: string, candidates: ContextEntry[]): RankedResult[];
}

/**
 * Lexical similarity ranker (MVP, no vector DB).
 * - Lowercase tokenize + stemming (prefer/preference → same stem)
 * - Boost exact phrase matches
 * - Boost tag matches
 * - Optional recency bonus
 */
export class LexicalRanker implements Ranker {
  score(query: string, candidates: ContextEntry[]): RankedResult[] {
    const q = query.toLowerCase().trim();
    const qTokens = tokenize(q);
    if (qTokens.length === 0) {
      return candidates.slice(0, 20).map((c) => toResult(c, 0));
    }

    const now = Date.now();
    const scored = candidates.map((c) => {
      let score = 0;
      const content = c.content.toLowerCase();
      const contentTokens = tokenize(c.content);

      // Exact phrase match (high boost)
      if (content.includes(q)) {
        score += 10;
      }

      // Token overlap (with stemming: prefer/preference match)
      const qStems = qTokens.map((t) => stemmer(t));
      const contentStems = contentTokens.map((t) => stemmer(t));
      const overlap = qStems.filter((s) => contentStems.includes(s)).length;
      score += overlap * 2;

      // Tag match
      if (c.tags?.length) {
        const tagMatch = c.tags.some((tag: string) =>
          tag.toLowerCase().includes(q) || q.includes(tag.toLowerCase())
        );
        if (tagMatch) score += 5;
      }

      // Recency bonus (last 7 days)
      const created = new Date(c.created_at).getTime();
      const daysSince = (now - created) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += 0.5;

      return { candidate: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map(({ candidate, score }) => toResult(candidate, score));
  }
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function toResult(m: ContextEntry, score: number): RankedResult {
  let snippet = m.content.slice(0, MAX_SNIPPET_LENGTH);
  if (m.content.length > MAX_SNIPPET_LENGTH) {
    snippet += '...';
  }
  return {
    id: m.id,
    scope: m.scope,
    score,
    snippet,
    created_at: m.created_at,
    source_tool: m.source_tool,
  };
}
