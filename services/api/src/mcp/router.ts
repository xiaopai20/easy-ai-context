import type { UserIdentity } from '@context/shared';
import { handleListPaths } from './handlers/list-paths.js';
import { handleGet } from './handlers/get.js';
import { handleSet } from './handlers/set.js';
import { handleDelete } from './handlers/delete.js';

export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const TOOL_HANDLERS: Record<string, (userId: string, args: Record<string, unknown>) => Promise<unknown>> = {
  'context.list_paths': async (userId, args) => handleListPaths(userId, args as { prefix?: string }),
  'context.get': async (userId, args) => handleGet(userId, args as { path: string }),
  'context.set': async (userId, args) => handleSet(userId, args as { path: string; content: string }),
  'context.delete': async (userId, args) => handleDelete(userId, args as { path: string }),
};

export async function routeMcpTool(
  user: UserIdentity,
  toolCall: McpToolCall
): Promise<McpToolResult> {
  const handler = TOOL_HANDLERS[toolCall.name];
  if (!handler) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }) }],
      isError: true,
    };
  }

  try {
    const args = toolCall.arguments || {};
    const result = await handler(user.userId, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
}

export function getToolSchemas(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}> {
  const readOnly = {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  };
  const writeNonDestructive = {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  };
  const destructive = {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: true,
  };
  const modelVisible = { _meta: { ui: { visibility: ['model'] as const } } };

  return [
    {
      name: 'context.list_paths',
      description: 'List context node paths for the current user. Use this first to discover what context exists. If prefix is provided, returns the subtree under that prefix (includes the prefix node itself only if it exists) plus all descendant paths. Note: this returns paths only (no content); call context.get after selecting paths.',
      inputSchema: {
        type: 'object',
        properties: { prefix: { type: 'string' } },
      },
      annotations: readOnly,
      ...modelVisible,
    },
    {
      name: 'context.get',
      description: 'Get the saved context content for a single path. Paths are normalized to lowercase and / separators. If the path does not exist, returns empty content.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      annotations: readOnly,
      ...modelVisible,
    },
    {
      name: 'context.set',
      description: 'Create or replace the content at a path (upsert). This overwrites any existing content at that path. Policy: keep nodes small (well under DynamoDB 400KB; recommended <50–100KB). Use children for detail and keep parents as roll-up summaries; when updating a node, also update parent roll-ups.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      annotations: writeNonDestructive,
      ...modelVisible,
    },
    {
      name: 'context.delete',
      description: 'Delete a context node at a path. This is destructive. Policy: do not delete unless the user explicitly asks; prefer marking content as ARCHIVED via context.set.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      annotations: destructive,
      ...modelVisible,
    },
  ];
}
