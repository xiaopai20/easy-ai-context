import { SCOPE_PATTERN, MAX_SCOPE_DEPTH } from './constants';

/**
 * Validate scope ID format and depth.
 * Allowed chars: lowercase alphanumeric, colon, underscore, hyphen.
 * Max depth: 10 (e.g. project:ai-context:infra = 3 levels)
 */
export function validateScopeId(scopeId: string): { valid: boolean; error?: string } {
  if (!scopeId || typeof scopeId !== 'string') {
    return { valid: false, error: 'scope required' };
  }

  const trimmed = scopeId.trim();
  if (!trimmed) {
    return { valid: false, error: 'scope required' };
  }

  if (!SCOPE_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid scope: allowed chars are a-z, 0-9, :, _, - (got: ${scopeId})`,
    };
  }

  const depth = trimmed.split(':').length;
  if (depth > MAX_SCOPE_DEPTH) {
    return {
      valid: false,
      error: `Scope depth exceeds max (${MAX_SCOPE_DEPTH})`,
    };
  }

  return { valid: true };
}

/**
 * Check if childScope is a descendant of (or equal to) parentScope.
 * e.g. isChildOf("project:ai-context:infra", "project:ai-context") => true
 */
export function isChildOf(childScope: string, parentScope: string): boolean {
  if (childScope === parentScope) return true;
  if (!parentScope) return true;
  return childScope.startsWith(parentScope + ':');
}

/**
 * Get scope IDs that match target (exact or children).
 * Bounded by maxScopes.
 */
export function expandScopes(
  allScopeIds: string[],
  targetScope: string,
  includeChildren: boolean,
  maxScopes: number
): string[] {
  const matched = includeChildren
    ? allScopeIds.filter((id) => id === targetScope || id.startsWith(targetScope + ':'))
    : allScopeIds.filter((id) => id === targetScope);

  if (matched.length > maxScopes) {
    throw new Error(`Too many scopes (${matched.length}). Narrow scope or set include_children=false. Max: ${maxScopes}`);
  }

  return matched;
}
