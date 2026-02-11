// Scope validation
export const SCOPE_PATTERN = /^[a-z0-9:_-]+$/;
export const MAX_SCOPE_DEPTH = 10;
export const MAX_SCOPE_LENGTH = 256;

// Context entry limits
export const MAX_CONTENT_LENGTH = 4096;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 64;
export const MAX_SNIPPET_LENGTH = 400;

// Query limits
export const MAX_SCOPES_IN_EXPANSION = 50;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;
export const CANDIDATES_PER_SCOPE = 200;
/** Minimum score to include in search results (filters out zero/recency-only matches) */
export const MIN_SEARCH_SCORE = 1;

// Secret patterns (basic regex for anti-poisoning)
export const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /aws_secret_access_key\s*=\s*[\w+/=]{40}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[a-zA-Z0-9]{20,}/, // OpenAI secret key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
  /xoxb-[a-zA-Z0-9-]+/i, // Slack bot token
  /password\s*[:=]\s*["']?[^\s"']+["']?/i,
  /api[_-]?key\s*[:=]\s*["']?[^\s"']+["']?/i,
];

/** Initial scopes created when a user first calls list_scopes (legacy; not used by path-based tools) */
export const INITIAL_SCOPES = [
  {
    id: 'personal',
    description: 'Personal preferences and long-term facts',
    default: true,
  },
  {
    id: 'work',
    description: 'Work-related architecture and decisions',
    default: false,
  },
  {
    id: 'project',
    description: 'Project-specific notes and context',
    default: false,
  },
] as const;

export const DEFAULT_CONFIG = {
  allowCreateScope: false,
  maxScopeDepth: MAX_SCOPE_DEPTH,
  maxContentLength: MAX_CONTENT_LENGTH,
  maxTags: MAX_TAGS,
  maxSnippetLength: MAX_SNIPPET_LENGTH,
  maxScopesInExpansion: MAX_SCOPES_IN_EXPANSION,
};
