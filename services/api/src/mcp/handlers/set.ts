import { setNode } from '../../dal/context.js';
import { normalizePath } from '@context/shared';
import { containsSecretPatterns, validateContentAndTags } from '../../safety.js';

export async function handleSet(
  userId: string,
  args: {
    path: string;
    content: string;
    /** Required when updating an existing node (from context_get). Omit or null for create. */
    ifMatchVersion?: string | null;
    /** Required when path has a parent (e.g. "a/b/c"); provide updated roll-up for the immediate parent. */
    parentSummary?: string;
  }
): Promise<{ ok: true }> {
  const path = normalizePath(args.path);
  if (typeof args.content !== 'string') {
    throw new Error('content must be a string');
  }
  const content = args.content;

  if (containsSecretPatterns(content)) {
    throw new Error('Content appears to contain secrets or credentials; rejected for safety.');
  }
  const validation = validateContentAndTags(content);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Content validation failed');
  }

  const parentSummary = args.parentSummary;
  if (parentSummary !== undefined && parentSummary !== null) {
    if (typeof parentSummary !== 'string') {
      throw new Error('parentSummary must be a string');
    }
    if (containsSecretPatterns(parentSummary)) {
      throw new Error('parentSummary appears to contain secrets or credentials; rejected for safety.');
    }
    const parentValidation = validateContentAndTags(parentSummary);
    if (!parentValidation.valid) {
      throw new Error(`parentSummary: ${parentValidation.error ?? 'Content validation failed'}`);
    }
  }

  console.log(JSON.stringify({ tool: 'context_set', userId, path }));

  await setNode(userId, path, content, {
    ifMatchVersion: args.ifMatchVersion,
    parentSummary: parentSummary ?? undefined,
  });
  return { ok: true };
}

