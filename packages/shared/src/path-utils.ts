/**
 * Normalize and validate a context path.
 *
 * Rules:
 * - input must be non-empty string
 * - trim
 * - replace '\' with '/'
 * - collapse '//' -> '/'
 * - remove leading '/'
 * - remove trailing '/'
 * - reject '.' or '..' segments
 * - convert to lowercase
 * - allowed per segment: [a-z0-9_-]+ only
 * - max length 200
 */
export function normalizePath(s: string): string {
  if (typeof s !== 'string') {
    throw new Error('path must be a string');
  }

  let v = s.trim();
  if (!v) {
    throw new Error('path is required');
  }

  v = v.replace(/\\/g, '/');
  while (v.includes('//')) v = v.replace(/\/{2,}/g, '/');
  while (v.startsWith('/')) v = v.slice(1);
  while (v.endsWith('/')) v = v.slice(0, -1);

  v = v.trim();
  if (!v) {
    throw new Error('path is required');
  }

  v = v.toLowerCase();

  if (v.length > 200) {
    throw new Error('path too long (max 200)');
  }

  const segments = v.split('/');
  for (const seg of segments) {
    if (!seg) throw new Error('invalid path: empty segment');
    if (seg === '.' || seg === '..') throw new Error('invalid path: dot segments not allowed');
    if (!/^[a-z0-9_-]+$/.test(seg)) {
      throw new Error('invalid path: allowed chars per segment are a-z, 0-9, _, -');
    }
  }

  return segments.join('/');
}

