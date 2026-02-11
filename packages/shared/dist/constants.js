"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.INITIAL_SCOPES = exports.SECRET_PATTERNS = exports.MIN_SEARCH_SCORE = exports.CANDIDATES_PER_SCOPE = exports.MAX_SEARCH_LIMIT = exports.DEFAULT_SEARCH_LIMIT = exports.MAX_SCOPES_IN_EXPANSION = exports.MAX_SNIPPET_LENGTH = exports.MAX_TAG_LENGTH = exports.MAX_TAGS = exports.MAX_CONTENT_LENGTH = exports.MAX_SCOPE_LENGTH = exports.MAX_SCOPE_DEPTH = exports.SCOPE_PATTERN = void 0;
// Scope validation
exports.SCOPE_PATTERN = /^[a-z0-9:_-]+$/;
exports.MAX_SCOPE_DEPTH = 10;
exports.MAX_SCOPE_LENGTH = 256;
// Context entry limits
exports.MAX_CONTENT_LENGTH = 4096;
exports.MAX_TAGS = 20;
exports.MAX_TAG_LENGTH = 64;
exports.MAX_SNIPPET_LENGTH = 400;
// Query limits
exports.MAX_SCOPES_IN_EXPANSION = 50;
exports.DEFAULT_SEARCH_LIMIT = 20;
exports.MAX_SEARCH_LIMIT = 100;
exports.CANDIDATES_PER_SCOPE = 200;
/** Minimum score to include in search results (filters out zero/recency-only matches) */
exports.MIN_SEARCH_SCORE = 1;
// Secret patterns (basic regex for anti-poisoning)
exports.SECRET_PATTERNS = [
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
exports.INITIAL_SCOPES = [
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
];
exports.DEFAULT_CONFIG = {
    allowCreateScope: false,
    maxScopeDepth: exports.MAX_SCOPE_DEPTH,
    maxContentLength: exports.MAX_CONTENT_LENGTH,
    maxTags: exports.MAX_TAGS,
    maxSnippetLength: exports.MAX_SNIPPET_LENGTH,
    maxScopesInExpansion: exports.MAX_SCOPES_IN_EXPANSION,
};
//# sourceMappingURL=constants.js.map