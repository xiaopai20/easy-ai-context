export declare const SCOPE_PATTERN: RegExp;
export declare const MAX_SCOPE_DEPTH = 10;
export declare const MAX_SCOPE_LENGTH = 256;
export declare const MAX_CONTENT_LENGTH = 4096;
export declare const MAX_TAGS = 20;
export declare const MAX_TAG_LENGTH = 64;
export declare const MAX_SNIPPET_LENGTH = 400;
export declare const MAX_SCOPES_IN_EXPANSION = 50;
export declare const DEFAULT_SEARCH_LIMIT = 20;
export declare const MAX_SEARCH_LIMIT = 100;
export declare const CANDIDATES_PER_SCOPE = 200;
/** Minimum score to include in search results (filters out zero/recency-only matches) */
export declare const MIN_SEARCH_SCORE = 1;
export declare const SECRET_PATTERNS: RegExp[];
/** Initial scopes created when a user first calls list_scopes (legacy; not used by path-based tools) */
export declare const INITIAL_SCOPES: readonly [{
    readonly id: "personal";
    readonly description: "Personal preferences and long-term facts";
    readonly default: true;
}, {
    readonly id: "work";
    readonly description: "Work-related architecture and decisions";
    readonly default: false;
}, {
    readonly id: "project";
    readonly description: "Project-specific notes and context";
    readonly default: false;
}];
export declare const DEFAULT_CONFIG: {
    allowCreateScope: boolean;
    maxScopeDepth: number;
    maxContentLength: number;
    maxTags: number;
    maxSnippetLength: number;
    maxScopesInExpansion: number;
};
//# sourceMappingURL=constants.d.ts.map