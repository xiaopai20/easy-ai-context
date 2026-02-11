/**
 * Pluggable embeddings provider interface for optional reranking.
 * Implementations: OpenAI, Bedrock stubs.
 * Legacy note: this repo previously had search/upsert tools.
 * This module is currently unused by the path-based tool MVP.
 * Guardrails: never embed items marked sensitivity=secret.
 */

import type { ContextEntry } from '@context/shared';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  readonly modelId: string;
}

export interface RankedResult {
  id: string;
  scope: string;
  score: number;
  snippet: string;
  created_at: string;
  source_tool?: string;
}

/**
 * Embeddings-based ranker. Computes query embedding, then cosine similarity over candidates.
 * Requires candidates to have pre-computed embeddings (from upsert).
 */
export class EmbeddingsRanker {
  constructor(
    private provider: EmbeddingProvider,
    private cache: Map<string, number[]> = new Map()
  ) {}

  async score(query: string, candidates: ContextEntry[]): Promise<RankedResult[]> {
    // Skip items marked secret
    const safe = candidates.filter((c) => c.sensitivity !== 'secret');
    if (safe.length === 0) return [];

    const queryEmbedding = await this.getOrComputeEmbedding(query);

    const scored = await Promise.all(
      safe.map(async (c) => {
        const emb = c.embedding ?? (await this.getOrComputeEmbedding(c.content));
        const score = cosineSimilarity(queryEmbedding, emb);
        return {
          candidate: c,
          score,
        };
      })
    );

    scored.sort((a, b) => b.score - a.score);

    return scored.map(({ candidate, score }) => ({
      id: candidate.id,
      scope: candidate.scope,
      score,
      snippet: candidate.content.slice(0, 400) + (candidate.content.length > 400 ? '...' : ''),
      created_at: candidate.created_at,
      source_tool: candidate.source_tool,
    }));
  }

  private async getOrComputeEmbedding(text: string): Promise<number[]> {
    const key = `${this.provider.modelId}:${hashString(text)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const emb = await this.provider.embed(text);
    this.cache.set(key, emb);
    return emb;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}

/** Stub: OpenAI embeddings (implement with openai package when needed) */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  modelId = 'text-embedding-3-small';
  async embed(_text: string): Promise<number[]> {
    throw new Error('OpenAI embeddings not configured. Install openai package and set OPENAI_API_KEY.');
  }
}
