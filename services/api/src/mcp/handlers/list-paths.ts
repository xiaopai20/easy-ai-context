import { listPaths } from '../../dal/context.js';
import { normalizePath } from '@context/shared';

export async function handleListPaths(
  userId: string,
  args: { prefix?: string }
): Promise<{ paths: string[] }> {
  const prefix = args.prefix !== undefined ? normalizePath(args.prefix) : undefined;
  console.log(JSON.stringify({ tool: 'context.list_paths', userId, prefix }));

  const paths = await listPaths(userId, prefix);
  return { paths };
}

