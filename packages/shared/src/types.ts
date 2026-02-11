// User and Auth Types
export interface UserIdentity {
  userId: string;
  email: string;
  name: string;
}

// Scope types (hierarchical: personal, work, project:ai-context, project:ai-context:infra)
export interface Scope {
  id: string;
  parent_id?: string;
  description?: string;
  status?: 'active' | 'archived';
  default?: boolean;
  defaults_by_client?: Record<string, unknown>;
  created_at?: string;
}

export interface ScopeInput {
  scopeId: string;
  parentScopeId?: string;
  description?: string;
  defaultsByClient?: Record<string, unknown>;
}

// Context entry types
export interface ContextEntry {
  id: string;
  scope: string;
  content: string;
  content_hash?: string;
  tags?: string[];
  created_at: string;
  source_tool?: string;
  source_ref?: string;
  status: 'active' | 'deleted' | 'pending';
  sensitivity?: 'normal' | 'secret';
  embedding?: number[]; // optional, for rerank
}

export interface ContextEntryInput {
  scope: string;
  content: string;
  tags?: string[];
  source_tool?: string;
  source_ref?: string;
  require_approval?: boolean;
}

// MCP Tool Input/Output types
export interface ListScopesInput {
  prefix?: string;
}

export interface ListScopesOutput {
  scopes: Array<{ id: string; parent_id?: string; description?: string; status?: string }>;
}

export interface SearchInput {
  query: string;
  scope: string;
  include_children?: boolean;
  limit?: number;
  include_pending?: boolean;
}

export interface SearchResult {
  id: string;
  scope: string;
  score: number;
  snippet: string;
  created_at: string;
  source_tool?: string;
}

export interface SearchOutput {
  results: SearchResult[];
}

export interface UpsertInput {
  scope: string;
  content: string;
  tags?: string[];
  source_tool?: string;
  source_ref?: string;
  require_approval?: boolean;
}

export interface UpsertOutput {
  id: string;
  status: 'active' | 'pending';
}

export interface GetInput {
  scope: string;
  id: string;
}

export interface GetOutput {
  id: string;
  scope: string;
  content: string;
  tags?: string[];
  created_at: string;
  source_tool?: string;
  status: string;
}

export interface DeleteInput {
  scope: string;
  id: string;
}

export interface DeleteOutput {
  id: string;
  status: 'deleted';
}

// Config
export interface ContextServiceConfig {
  tableName: string;
  allowCreateScope: boolean;
  maxScopeDepth: number;
  maxContentLength: number;
  maxTags: number;
  maxSnippetLength: number;
  maxScopesInExpansion: number;
}
