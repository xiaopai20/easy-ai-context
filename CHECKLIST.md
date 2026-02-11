# Personal Context Service - File Checklist

## 1) Repo Bootstrap

| File | Purpose |
|------|---------|
| `package.json` | Root workspace config (services, packages, proxy) |
| `tsconfig.json` | Root TypeScript config |
| `docker-compose.yml` | Local dev: DynamoDB Local + API |
| `Dockerfile.api` | API container build |
| `infra/src/main.ts` | CDK app entry |
| `infra/src/context-stack.ts` | CDK stack: Cognito, API Gateway, Lambda, DynamoDB |
| `infra/package.json` | CDK infra deps |
| `services/api/src/index.ts` | Lambda handler export |
| `services/api/src/lambda.ts` | Request routing: /hello, /mcp |
| `services/api/src/local-server.ts` | Local HTTP server (dev) |
| `packages/shared/src/types.ts` | Scope, context entry, MCP tool types |
| `packages/shared/src/constants.ts` | Limits, patterns |
| `packages/shared/src/index.ts` | Shared exports |

## 2) Cognito + JWT Auth

| File | Purpose |
|------|---------|
| `packages/shared/src/auth.ts` | JWT verify, dev mode bypass, token extraction |
| `infra/src/context-stack.ts` | Cognito User Pool, OAuth client (PKCE) |
| `docs/mcp-cursor-config.md` | App client, callback URLs, ChatGPT connector |

## 3) DynamoDB Data Access Layer

| File | Purpose |
|------|---------|
| `services/api/src/dal/context.ts` | listPaths, getNode, setNode, deleteNode (Option C) |
| `services/api/tests/dal/context.test.ts` | SK format, begins_with tests |

## 4) MCP Tool Schema & Router

| File | Purpose |
|------|---------|
| `services/api/src/mcp/router.ts` | routeMcpTool, getToolSchemas |
| `services/api/src/mcp/handlers/list-paths.ts` | context.list_paths |
| `services/api/src/mcp/handlers/set.ts` | context.set |
| `services/api/src/mcp/handlers/get.ts` | context.get |
| `services/api/src/mcp/handlers/delete.ts` | context.delete |

## 5) Search Ranking MVP

| File | Purpose |
|------|---------|
| `services/api/src/rankers/lexical.ts` | LexicalRanker: tokenize, phrase match, tag boost |
| `services/api/src/rankers/index.ts` | getRanker, setRanker |
| `services/api/tests/rankers.test.ts` | LexicalRanker fixture tests |

## 6) Optional Embeddings Rerank

| File | Purpose |
|------|---------|
| `services/api/src/rankers/embeddings.ts` | EmbeddingProvider, EmbeddingsRanker, OpenAI stub |

## 7) Cursor Stdio Proxy

| File | Purpose |
|------|---------|
| `proxy/src/index.ts` | MCP stdio proxy, forwards to API with Bearer token |
| `proxy/package.json` | Proxy deps |
| `docs/mcp-cursor-config.md` | mcp.json snippet for Cursor |

## 8) Safety Rules

| File | Purpose |
|------|---------|
| `services/api/src/safety.ts` | containsSecretPatterns, validateContentAndTags |
| `packages/shared/src/constants.ts` | SECRET_PATTERNS |
| `services/api/tests/safety.test.ts` | Secret rejection, content validation |

## 9) Definition of Done

| File | Purpose |
|------|---------|
| `docs/E2E-TEST-PLAN.md` | Unit, integration, smoke, ChatGPT, Cursor steps |
| `scripts/insert-context.ts` | Insert example context entries |
| `scripts/search-example.ts` | Run example searches |
| `services/api/tests/*.test.ts` | Unit tests |
| `services/api/tests/*Integration.test.ts` | Integration tests |
