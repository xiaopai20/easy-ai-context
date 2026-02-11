import { SECRET_PATTERNS, MAX_CONTENT_LENGTH, MAX_TAGS } from '@context/shared';

/**
 * Check if content matches secret patterns. Reject for anti-poisoning.
 */
export function containsSecretPatterns(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  return SECRET_PATTERNS.some((pattern: RegExp) => pattern.test(content));
}

/**
 * Validate content length and tags count.
 */
export function validateContentAndTags(
  content: string,
  tags?: string[]
): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'content required' };
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      error: `Content exceeds max length (${MAX_CONTENT_LENGTH} chars)`,
    };
  }

  if (tags && tags.length > MAX_TAGS) {
    return {
      valid: false,
      error: `Too many tags (max ${MAX_TAGS})`,
    };
  }

  return { valid: true };
}
