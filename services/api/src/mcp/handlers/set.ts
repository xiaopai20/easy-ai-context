import { setNode } from '../../dal/context.js';
import { normalizePath } from '@context/shared';
import { containsSecretPatterns, validateContentAndTags } from '../../safety.js';

export async function handleSet(
  userId: string,
  args: { path: string; content: string }
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

  console.log(JSON.stringify({ tool: 'context.set', userId, path }));

  await setNode(userId, path, content);
  return { ok: true };
}

