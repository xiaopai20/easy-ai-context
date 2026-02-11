"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAuth = initializeAuth;
exports.verifyToken = verifyToken;
exports.extractTokenFromHeader = extractTokenFromHeader;
const aws_jwt_verify_1 = require("aws-jwt-verify");
let idVerifier = null;
let accessVerifier = null;
function initializeAuth(config) {
    if (config.devMode) {
        return; // Skip verifier initialization in dev mode
    }
    idVerifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        tokenUse: 'id',
        clientId: config.clientId,
    });
    accessVerifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        tokenUse: 'access',
        clientId: config.clientId,
    });
}
async function fetchUserInfo(accessToken, userInfoUrl) {
    const res = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
        return {};
    const data = (await res.json());
    return {
        email: typeof data.email === 'string' ? data.email : undefined,
        name: typeof data.name === 'string' ? data.name : (typeof data['cognito:username'] === 'string' ? data['cognito:username'] : undefined),
    };
}
async function verifyToken(token, config) {
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
    }
    catch {
        // Fall through to try access_token
    }
    // Try access_token (Cursor and other OAuth clients send this)
    try {
        const payload = await accessVerifier.verify(token);
        const userId = typeof payload.sub === 'string' ? payload.sub : '';
        const username = typeof payload.username === 'string' ? payload.username : '';
        let email = typeof payload.email === 'string' ? payload.email : '';
        let name = typeof payload.name === 'string' ? payload.name : username;
        if (!email && config.userInfoUrl) {
            const userInfo = await fetchUserInfo(token, config.userInfoUrl);
            email = userInfo.email || username;
            name = userInfo.name || name;
        }
        else if (!email) {
            email = username;
        }
        return { userId, email, name };
    }
    catch (error) {
        throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
function extractTokenFromHeader(authHeader) {
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
//# sourceMappingURL=auth.js.map