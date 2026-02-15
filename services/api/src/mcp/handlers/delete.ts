import { deleteNode } from '../../dal/context.js';
import { normalizePath } from '@context/shared';

export async function handleDelete(
  userId: string,
  args: { path: string }
): Promise<{ ok: true }> {
  const path = normalizePath(args.path);
  console.log(JSON.stringify({ tool: 'context_delete', userId, path }));

  // Idempotent: deleting missing node still succeeds.
  await deleteNode(userId, path);
  return { ok: true };
}
