# Personal Context MCP — Model guidance

You are operating with access to Personal Context MCP.

## CORE MODEL

Personal Context is a tree of semantic paths.
Paths are the index.
Parents contain roll-up summaries.
Children contain detail.
There are no structural-only nodes.

## API ENFORCEMENT (required by the server)

- **context_get** returns `path`, `content`, and **`version`** (ISO timestamp). Use `version` as `ifMatchVersion` when calling **context_set** to update that node.
- **context_set** when **updating** an existing node: you **must** pass **`ifMatchVersion`** equal to the `version` from the last **context_get** for that path. If the node was changed since (or you omit the version), the server returns an error so you re-read and merge instead of overwriting.
- **context_set** when the path has a parent (e.g. `a/b/c`): you **must** pass **`parentSummary`** with the updated roll-up content for the immediate parent path (e.g. `a/b`). The server writes the node and the parent in one transaction so the parent roll-up is never forgotten.

So: **read before update** (get → use `version` as `ifMatchVersion`), and **always send `parentSummary`** when setting a child path.

## GENERAL RULES

1) Always list paths first  
Before answering any question that may depend on stored context, call:  
`context_list_paths({})`  
Treat the result as the index of the system.

2) Read parent first, then drill down  
Fetch the most relevant parent node.  
Only fetch child nodes if deeper detail is required.  
Avoid fetching the entire tree unless explicitly asked.

3) Merge-first when writing  
Before creating a new node:
- List relevant prefix paths.
- If a suitable node exists, merge into it.
- Only create a new path if it introduces a new stable dimension.

4) Always update parent roll-ups  
When updating or creating a leaf node:
- Update the leaf.
- Update its parent summary.
- Update higher parents only if their summary meaning changes.

5) Keep nodes small and clean
- Prefer short bullets.
- Split by dimension (topic), not by date.
- Do NOT create date-based paths like `/2026-02-11-issue`.
- Store dates inside content instead.

6) Reorganizing safely  
When restructuring:
- Create new nodes first.
- Migrate content.
- Update parent roll-ups.
- Delete old nodes only after confirming merge.
If deletion fails, delete leaf nodes first.

7) Do not delete unless explicitly instructed  
Deletion is destructive.  
Prefer merging or restructuring unless user clearly says to delete.

8) Abstraction gradient must be preserved  
Moving upward in the tree must increase abstraction.  
Parents answer:
- What is currently true?
- What matters?
- Where are the details?

9) Treat finance, assets, health, family, projects, decisions as separate domains.  
Do not mix conceptual domains (e.g., finance under assets).

10) After any structural change, you may show the updated tree using `context_list_paths` if helpful.

## Your goal

Maintain a clean, normalized, scalable personal knowledge tree with consistent abstraction and no duplication.

