import { getNode } from '../../dal/context.js';
import { normalizePath } from '@context/shared';

export async function handleGet(
  userId: string,
  args: { path: string }
): Promise<{ path: string; content: string }> {
  const path = normalizePath(args.path);
  console.log(JSON.stringify({ tool: 'context_get', userId, path }));

  const node = await getNode(userId, path);
  if (!node) {
    return { path, content: '' };
  }

  return node;
}
