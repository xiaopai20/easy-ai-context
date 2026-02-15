import { listPaths } from '../../dal/context.js';
import { normalizePath } from '@context/shared';

export async function handleListPaths(
  userId: string,
  args: { prefix?: string; path?: string }
): Promise<{ paths: string[] }> {
  // Accept prefix or path (some clients use "path" for the subtree root); empty = list all
  const raw = args.prefix ?? args.path;
  const prefix = typeof raw === 'string' && raw.trim() ? normalizePath(raw.trim()) : undefined;
  console.log(JSON.stringify({ tool: 'context_list_paths', userId, prefix }));

  const paths = await listPaths(userId, prefix);
  return { paths };
}

