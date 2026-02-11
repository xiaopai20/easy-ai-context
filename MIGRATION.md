# Migration notes (Context paths + Option C DynamoDB schema)

## DynamoDB table schema

This version stores **context nodes** addressed by a normalized `path` (e.g. `projects/easy-ai`).

- **PK** (string)
- **SK** (string)
- **GSI1** (name: `GSI1`)
  - **GSI1_PK** (string)
  - **GSI1_SK** (string)
  - **Projection**: **KEYS_ONLY** (or **INCLUDE** only `updated_at`). **Do not project `content`.**

## Item shape written by `context.set`

Base item (one item per node):

- `PK` = `USER#${userId}#CONTEXT`
- `SK` = `PATH#${path}`
- `content` = string
- `updated_at` = ISO string
- `GSI1_PK` = `USER#${userId}`
- `GSI1_SK` = `PATH#${path}`

## Coexistence with old data

If you have existing table data from older “memory” versions, you can **coexist in the same table** because this version uses a different base prefix:

- old: `PK = USER#...#MEMORY` (or other legacy prefixes)
- new: `PK = USER#...#CONTEXT`

However, you **must** ensure the table has the required **GSI1** with keys **`GSI1_PK`/`GSI1_SK`** and a projection that does not include `content`.

If your existing table uses different GSI attribute names (e.g. `GSI1PK/GSI1SK`), the simplest approach is to **create a new table** (recommended) and point `TABLE_NAME` to it.

