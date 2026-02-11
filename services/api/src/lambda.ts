import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { initializeAuth, verifyToken, extractTokenFromHeader } from '@context/shared';
import type { UserIdentity } from '@context/shared';
import { routeMcpTool, getToolSchemas } from './mcp/router.js';

const DEV_MODE = process.env.DEV_MODE === 'true';

function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isAllowed(user: UserIdentity): boolean {
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return true; // No restriction when unset
  return allowed.includes((user.email || '').toLowerCase());
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  initializeAuth({
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
      const metadata = (await res.json()) as Record<string, unknown>;
      return json(200, metadata);
    }

    // GET /.well-known/oauth-protected-resource[/*] - RFC 9728 (optional)
    if ((path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp' || path.endsWith('oauth-protected-resource')) && method === 'GET') {
      const apiBase = process.env.API_BASE_URL || '';
      const cognitoIssuer = process.env.COGNITO_ISSUER_URL || '';
      if (!apiBase || !cognitoIssuer) {
        return json(500, { error: 'OAuth configuration not set' });
      }
      return json(200, {
        resource: `${apiBase}/mcp`,
        authorization_servers: [cognitoIssuer],
        scopes_supported: ['openid', 'email', 'profile'],
      });
    }

    // GET /hello - legacy health
    if (path === '/hello' && method === 'GET') {
      const authHeader = event.headers?.authorization || (event.headers as Record<string, string> | undefined)?.Authorization;
      const user = await verifyToken(
        extractTokenFromHeader(authHeader),
        { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE }
      );
      return json(200, { message: 'Hello World', userId: user.userId });
    }

    // GET /mcp or /mcp/sse - Streamable HTTP: return SSE stream when client requests it (Cursor needs this)
    if ((path === '/mcp' || path === '/mcp/sse') && method === 'GET') {
      const accept = event.headers?.accept || event.headers?.Accept || '';
      if (accept.includes('text/event-stream')) {
        const authHeader = event.headers?.authorization || (event.headers as Record<string, string> | undefined)?.Authorization;
        const user = await verifyToken(
          extractTokenFromHeader(authHeader),
          { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE }
        );
        if (!isAllowed(user)) {
          return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope');
        }
        // Minimal SSE: send one event so Cursor can open the stream; Lambda can't hold long connections
        const sseBody = `data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n\n`;
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
      const authHeader = event.headers?.authorization || (event.headers as Record<string, string> | undefined)?.Authorization;
      const user = await verifyToken(
        extractTokenFromHeader(authHeader),
        { userPoolId: process.env.COGNITO_USER_POOL_ID || '', clientId: process.env.COGNITO_CLIENT_ID || '', userInfoUrl: process.env.COGNITO_USERINFO_URL, devMode: DEV_MODE }
      );
      if (!isAllowed(user)) {
        return jsonWithWWWAuth(403, { error: 'Access denied: email not in allowed list' }, 'insufficient_scope');
      }

      const body = parseBody(event.body);
      const jsonrpc = (typeof body === 'object' && body !== null ? body : {}) as {
        jsonrpc?: string;
        id?: string | number;
        method?: string;
        params?: { name?: string; arguments?: Record<string, unknown> };
      };

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
          result: { tools: getToolSchemas() },
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
        const result = await routeMcpTool(user, {
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

    return json(404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonWithWWWAuth(401, { error: message }, 'invalid_token');
  }
};

function getOAuthChallengeHeaders(errorType: 'invalid_token' | 'insufficient_scope' = 'invalid_token'): Record<string, string> {
  const apiBase = process.env.API_BASE_URL || '';
  // RFC 9728: resource_metadata so ChatGPT knows to restart OAuth
  // error= helps OpenAI clients recognize auth failure (per their troubleshooting)
  const metadataUrl = `${apiBase}/.well-known/oauth-protected-resource`;
  return {
    'WWW-Authenticate': `Bearer realm="mcp", error="${errorType}", resource_metadata="${metadataUrl}", scope="openid email profile"`,
  };
}

function jsonWithWWWAuth(
  status: number,
  data: unknown,
  errorType: 'invalid_token' | 'insufficient_scope' = 'invalid_token'
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      ...getOAuthChallengeHeaders(errorType),
    },
    body: JSON.stringify(data),
  };
}

function parseBody(body: string | undefined): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function json(status: number, data: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}
