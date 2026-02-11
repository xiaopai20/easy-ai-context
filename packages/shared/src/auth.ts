import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { UserIdentity } from './types';

export interface AuthConfig {
  userPoolId: string;
  clientId: string;
  userInfoUrl?: string;
  devMode?: boolean;
  devUserId?: string;
  devEmail?: string;
  devName?: string;
}

let idVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
let accessVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

export function initializeAuth(config: AuthConfig): void {
  if (config.devMode) {
    return; // Skip verifier initialization in dev mode
  }

  idVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'id',
    clientId: config.clientId,
  });
  accessVerifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  });
}

async function fetchUserInfo(accessToken: string, userInfoUrl: string): Promise<{ email?: string; name?: string }> {
  const res = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as Record<string, unknown>;
  return {
    email: typeof data.email === 'string' ? data.email : undefined,
    name: typeof data.name === 'string' ? data.name : (typeof data['cognito:username'] === 'string' ? data['cognito:username'] : undefined),
  };
}

export async function verifyToken(
  token: string | undefined,
  config: AuthConfig
): Promise<UserIdentity> {
  // Dev mode bypass
  if (config.devMode) {
    return {
      userId: config.devUserId || 'dev-user-123',
      email: config.devEmail || 'dev@example.com',
      name: config.devName || 'Dev User',
    };
  }

  if (!token) {
    throw new Error('No token provided');
  }

  if (!idVerifier || !accessVerifier) {
    throw new Error('Auth not initialized');
  }

  // Try id_token first (used by get-token.ts, manual Bearer tokens)
  try {
    const payload = await idVerifier.verify(token);
    return {
      userId: typeof payload.sub === 'string' ? payload.sub : '',
      email: typeof payload.email === 'string' ? payload.email : '',
      name: (typeof payload.name === 'string' ? payload.name : '') ||
        (typeof payload['cognito:username'] === 'string' ? payload['cognito:username'] : '') ||
        '',
    };
  } catch {
    // Fall through to try access_token
  }

  // Try access_token (Cursor and other OAuth clients send this)
  try {
    const payload = await accessVerifier.verify(token);
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    const username = typeof payload.username === 'string' ? payload.username : '';

    let email = typeof (payload as Record<string, unknown>).email === 'string' ? (payload as Record<string, unknown>).email as string : '';
    let name = typeof (payload as Record<string, unknown>).name === 'string' ? (payload as Record<string, unknown>).name as string : username;

    if (!email && config.userInfoUrl) {
      const userInfo = await fetchUserInfo(token, config.userInfoUrl);
      email = userInfo.email || username;
      name = userInfo.name || name;
    } else if (!email) {
      email = username;
    }

    return { userId, email, name };
  } catch (error) {
    throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }
  
  // Handle "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  
  return authHeader;
}
