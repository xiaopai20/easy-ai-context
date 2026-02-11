import { LexicalRanker } from './lexical';
import type { Ranker } from './lexical';

export type { Ranker, RankedResult } from './lexical';

/**
 * Uses lexical + stemming for Lambda compatibility (no large model in deploy).
 * Can be optimized to use embeddings (e.g. OpenAI API or SageMaker) for semantic search.
 */
let defaultRanker: Ranker = new LexicalRanker();

export function getRanker(): Ranker {
  return defaultRanker;
}

export function setRanker(ranker: Ranker): void {
  defaultRanker = ranker;
}
