# Server description

This server stores a user’s long-term context as a hierarchical tree of paths.
Each path represents one context node and contains a single curated “living summary” string.
Paths use lowercase with '/' separators (e.g. `projects/easy-ai/resume/fe`).

## Context organization policy

- **Storage limit**: Each node is stored as a single DynamoDB item and must stay under the 400KB item limit.
  Keep node content well below this limit (recommended < 50–100KB).
  If a node grows too large, split it into child nodes and rewrite the parent as a short roll-up summary.

- **Hierarchy rules**: Parent nodes summarize their children.
  Leaf nodes hold detailed context; parents hold concise overviews.

- **Writes**: When you update or delete a node, also update its parent node(s) so roll-up summaries remain accurate.
  Create missing parent nodes when adding new context.

- **Splitting and merging**:
  - Split nodes when content becomes long, mixes multiple topics, or naturally divides into subareas.
  - Merge nodes when siblings are very small or no longer meaningfully separate.
  - When splitting, write child nodes first, then rewrite the parent as a roll-up.
  - When merging, write the merged content first; delete old nodes only if the user explicitly asks.

- **Deletion safety**: Do not delete context unless the user explicitly requests deletion.
  Prefer marking content as ARCHIVED via an update instead of deleting.

## Recommended workflow

1) Discover paths using `context_list_paths`.
2) Read relevant nodes using `context_get`.
3) Answer the user.
4) If the user asks to save/update context, write with `context_set` and update parent roll-ups accordingly.

## Model guidance

See `docs/PERSONAL_CONTEXT_MCP.md` for model-facing operating rules.

