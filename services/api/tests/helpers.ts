export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3010';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error || `HTTP ${response.status}`
    );
  }

  return body;
}
