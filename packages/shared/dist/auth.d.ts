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
export declare function initializeAuth(config: AuthConfig): void;
export declare function verifyToken(token: string | undefined, config: AuthConfig): Promise<UserIdentity>;
export declare function extractTokenFromHeader(authHeader: string | undefined): string | undefined;
//# sourceMappingURL=auth.d.ts.map