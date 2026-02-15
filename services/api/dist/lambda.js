"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const shared_1 = require("@context/shared");
const router_js_1 = require("./mcp/router.js");
const DEV_MODE = process.env.DEV_MODE === 'true';
function getAllowedEmails() {
    const raw = process.env.ALLOWED_EMAILS || '';
    return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}
function isAllowed(user) {
    const allowed = getAllowedEmails();
    if (allowed.length === 0)
        return true; // No restriction when unset
    return allowed.includes((user.email || '').toLowerCase());
}
const handler = async (event) => {
    (0, shared_1.initializeAuth)({
        userPoolId: process.env.COGNITO_USER_POOL_ID || '',
        clientId: process.env.COGNITO_CLIENT_ID || '',
        devMode: DEV_MODE,
        devUserId: process.env.DEV_USER_ID,
        devEmail: process.env.DEV_EMAIL,
        devName: process.env.DEV_NAME,
    });
    const path = event.rawPath || event.requestContext?.http?.path || '';
    const method = event.requestContext?.http?.method || 'GET';
    console.log(JSON.stringify({ path, method, ts: new Date().toISOString() }));
    try {
        // GET /.well-known/oauth-authorization-server - MCP spec RFC 8414 (ChatGPT looks here)
        if (path === '/.well-known/oauth-authorization-server' && method === 'GET') {
            const discoveryUrl = process.env.COGNITO_OIDC_DISCOVERY_URL || '';
            if (!discoveryUrl) {
                return json(500, { error: 'OAuth configuration not set' });
            }
            const res = await fetch(discoveryUrl);
            if (!res.ok) {
                return json(502, { error: 'Failed to fetch authorization server metadata' });
            }
            const metadata = (await res.json());
            return json(200, metadata);
        }
        // GET /.well-known/oauth-protected-resource[/*] - RFC 9728 (optional)
        if ((path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp' || path === '/.well-known/oauth-protected-resource/mcp-test' || path.endsWith('oauth-protected-resource')) && method === 'GET') {
            const apiBase = process.env.API_BASE_URL || '';
            const cognitoIssuer = process.env.COGNITO_ISSUER_URL || '';
            if (!apiBase || !cognitoIssuer) {
                return json(500, { error: 'OAuth configuration not set' });
            }
            // Cursor validates token resource matches the URL; return the correct resource per path
            const resourcePath = path.includes('/mcp-test') ? '/mcp-test' : '/mcp';
            return json(200, {
                resource: `${apiBase}${resourcePath}`,
                authorization_servers: [cognitoIssuer],
                scopes_supported: ['openid', 'email', 'profile'],
            });
        }
        // GET /hello - legacy health
        if (path === '/hello' && method === 'GET') {
            const authHeader = event.headers?.authorization || event.headers?.Authorization;
            const user = await (0, shared_1.verifyToken)((0, shared_1.extractTokenFromHeader)(authHeader), { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE });
            return json(200, { message: 'Hello World', userId: user.userId });
        }
        // GET /mcp or /mcp/sse - Streamable HTTP (minimal: we respond with SSE format but do not actually stream)
        if ((path === '/mcp' || path === '/mcp/sse') && method === 'GET') {
            const accept = event.headers?.accept || event.headers?.Accept || '';
            if (accept.includes('text/event-stream')) {
                const authHeader = event.headers?.authorization || event.headers?.Authorization;
                const user = await (0, shared_1.verifyToken)((0, shared_1.extractTokenFromHeader)(authHeader), { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE });
                if (!isAllowed(user)) {
                    return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope');
                }
                // We do not stream: Lambda returns one response body and closes. Body is one SSE comment (no wrong-direction RPC).
                const sseBody = ': stream open\n\n';
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive',
                    },
                    body: sseBody,
                };
            }
            return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        // POST /mcp - MCP tool calls (JSON-RPC style)
        if (path === '/mcp' && method === 'POST') {
            const authHeader = event.headers?.authorization || event.headers?.Authorization;
            const user = await (0, shared_1.verifyToken)((0, shared_1.extractTokenFromHeader)(authHeader), { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE });
            if (!isAllowed(user)) {
                return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope', '/mcp');
            }
            const body = parseBody(event.body);
            const jsonrpc = (typeof body === 'object' && body !== null ? body : {});
            // MCP notifications (no id): return 202 Accepted per Streamable HTTP spec
            if (!jsonrpc.id && jsonrpc.method?.startsWith('notifications/')) {
                return { statusCode: 202, headers: { 'Content-Type': 'application/json' }, body: '' };
            }
            const rpcId = jsonrpc.id ?? null;
            // MCP initialize - required before tools/list for Streamable HTTP clients (e.g. ChatGPT)
            if (jsonrpc.method === 'initialize') {
                return json(200, {
                    jsonrpc: '2.0',
                    id: rpcId,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: { name: 'context', version: '1.0' },
                    },
                });
            }
            if (jsonrpc.method === 'tools/list') {
                return json(200, {
                    jsonrpc: '2.0',
                    id: rpcId,
                    result: { tools: (0, router_js_1.getToolSchemas)() },
                });
            }
            if (jsonrpc.method === 'resources/list') {
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { resources: [] } });
            }
            if (jsonrpc.method === 'resources/templates/list') {
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { resourceTemplates: [] } });
            }
            if (jsonrpc.method === 'prompts/list') {
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { prompts: [] } });
            }
            if (jsonrpc.method === 'prompts/get') {
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { description: '', messages: [] } });
            }
            if (jsonrpc.method === 'tools/call') {
                const params = jsonrpc.params ?? {};
                if (!params.name) {
                    return json(400, { jsonrpc: '2.0', id: rpcId, error: { code: -32602, message: 'Missing tool name' } });
                }
                const result = await (0, router_js_1.routeMcpTool)(user, {
                    name: params.name,
                    arguments: params.arguments,
                });
                return json(200, {
                    jsonrpc: '2.0',
                    id: rpcId,
                    result: {
                        content: result.content,
                        isError: result.isError,
                    },
                });
            }
            const unknownMethod = jsonrpc.method ?? '(no method)';
            console.log(JSON.stringify({ unknownMcpMethod: unknownMethod }));
            return json(400, { jsonrpc: '2.0', id: rpcId, error: { code: -32601, message: `Unknown MCP method: ${unknownMethod}` } });
        }
        // GET /mcp-test - same as /mcp: minimal SSE for Streamable HTTP (remote test endpoint)
        if ((path === '/mcp-test' || path === '/mcp-test/sse') && method === 'GET') {
            const accept = event.headers?.accept || event.headers?.Accept || '';
            if (accept.includes('text/event-stream')) {
                const authHeader = event.headers?.authorization || event.headers?.Authorization;
                const user = await (0, shared_1.verifyToken)((0, shared_1.extractTokenFromHeader)(authHeader), { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE });
                if (!isAllowed(user)) {
                    return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope', '/mcp');
                }
                const sseBody = ': stream open\n\n';
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive',
                    },
                    body: sseBody,
                };
            }
            return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        // POST /mcp-test - remote test MCP (one tool: remote_ping). Same auth as /mcp; use to check if agent sees remote URL MCPs.
        if (path === '/mcp-test' && method === 'POST') {
            const authHeader = event.headers?.authorization || event.headers?.Authorization;
            const user = await (0, shared_1.verifyToken)((0, shared_1.extractTokenFromHeader)(authHeader), { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE });
            if (!isAllowed(user)) {
                return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope', '/mcp-test');
            }
            const body = parseBody(event.body);
            const jsonrpc = (typeof body === 'object' && body !== null ? body : {});
            if (!jsonrpc.id && jsonrpc.method?.startsWith('notifications/')) {
                return { statusCode: 202, headers: { 'Content-Type': 'application/json' }, body: '' };
            }
            const rpcId = jsonrpc.id ?? null;
            // Incremental test: copy context-style tools to find what breaks Cursor agent visibility.
            // [1] remote_ping - baseline (underscore, minimal) - WORKS
            // [2] context_list_paths - underscore name (was dotted: agent could not see it)
            const testTools = [
                {
                    name: 'remote_ping',
                    description: 'Returns pong. Remote test tool on same server as context; if agent sees this, remote/URL MCPs work.',
                    inputSchema: { type: 'object', properties: {}, required: [] },
                },
                {
                    name: 'context_list_paths',
                    description: 'Test: underscore name. List context paths (prefix optional).',
                    inputSchema: { type: 'object', properties: { prefix: { type: 'string' } } },
                },
            ];
            if (jsonrpc.method === 'initialize') {
                return json(200, {
                    jsonrpc: '2.0',
                    id: rpcId,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: { name: 'remote-test', version: '1.0' },
                    },
                });
            }
            if (jsonrpc.method === 'tools/list') {
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { tools: testTools } });
            }
            if (jsonrpc.method === 'tools/call') {
                const params = jsonrpc.params ?? {};
                if (params.name === 'remote_ping') {
                    return json(200, {
                        jsonrpc: '2.0',
                        id: rpcId,
                        result: { content: [{ type: 'text', text: 'pong' }] },
                    });
                }
                if (params.name === 'context_list_paths') {
                    return json(200, {
                        jsonrpc: '2.0',
                        id: rpcId,
                        result: { content: [{ type: 'text', text: JSON.stringify({ paths: [] }) }] },
                    });
                }
                return json(200, {
                    jsonrpc: '2.0',
                    id: rpcId,
                    error: { code: -32602, message: `Unknown tool: ${params.name}` },
                });
            }
            if (jsonrpc.method === 'resources/list')
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { resources: [] } });
            if (jsonrpc.method === 'resources/templates/list')
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { resourceTemplates: [] } });
            if (jsonrpc.method === 'prompts/list')
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { prompts: [] } });
            if (jsonrpc.method === 'prompts/get')
                return json(200, { jsonrpc: '2.0', id: rpcId, result: { description: '', messages: [] } });
            return json(200, {
                jsonrpc: '2.0',
                id: rpcId,
                error: { code: -32601, message: `Unknown MCP method: ${jsonrpc.method ?? '(no method)'}` },
            });
        }
        return json(404, { error: 'Not found' });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const resourcePath = path.startsWith('/mcp-test') ? '/mcp-test' : '/mcp';
        return jsonWithWWWAuth(401, { error: message }, 'invalid_token', resourcePath);
    }
};
exports.handler = handler;
function getOAuthChallengeHeaders(errorType = 'invalid_token', resourcePath) {
    const apiBase = process.env.API_BASE_URL || '';
    // RFC 9728: resource_metadata must point to metadata for the requested resource; Cursor validates token resource matches URL
    const suffix = resourcePath === '/mcp-test' ? '/mcp-test' : '';
    const metadataUrl = `${apiBase}/.well-known/oauth-protected-resource${suffix}`;
    return {
        'WWW-Authenticate': `Bearer realm="mcp", error="${errorType}", resource_metadata="${metadataUrl}", scope="openid email profile"`,
    };
}
function jsonWithWWWAuth(status, data, errorType = 'invalid_token', resourcePath) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json',
            ...getOAuthChallengeHeaders(errorType, resourcePath),
        },
        body: JSON.stringify(data),
    };
}
function parseBody(body) {
    if (!body)
        return {};
    try {
        return JSON.parse(body);
    }
    catch {
        return {};
    }
}
function json(status, data) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    };
}
//# sourceMappingURL=lambda.js.map