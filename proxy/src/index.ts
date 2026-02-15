#!/usr/bin/env node
/**
 * MCP stdio proxy for Cursor.
 * Forwards MCP tool calls to the deployed AWS API with Authorization header.
 * Stdio transport works with the Cursor agent (unlike streamable HTTP URL).
 *
 * Usage:
 *   CONTEXT_API_URL=https://xxx.execute-api.region.amazonaws.com
 *   CONTEXT_ACCESS_TOKEN=<cognito-access-token>
 *   npx tsx src/index.ts
 */

import * as readline from 'readline';
import * as stream from 'stream';
import * as https from 'https';
import * as http from 'http';

const API_URL = process.env.CONTEXT_API_URL || 'http://localhost:3010';
const API_PATH = '/mcp';
const ACCESS_TOKEN = process.env.CONTEXT_ACCESS_TOKEN || '';
const TIMEOUT_MS = parseInt(process.env.CONTEXT_TIMEOUT_MS || '30000', 10);

// Use a no-op writable for readline so only our JSON-RPC responses go to stdout (MCP reads that)
const noop = new stream.Writable({ write(_chunk, _enc, cb) { cb(); } });
const rl = readline.createInterface({ input: process.stdin, output: noop, terminal: false });

function log(msg: string): void {
  process.stderr.write(`[context-proxy] ${msg}\n`);
}

/** Send a JSON-RPC response to stdout (only valid MCP messages go here). */
function sendResponse(msg: object): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

/** Normalize API error to JSON-RPC 2.0 format (object with code and message). */
function toJsonRpcError(err: unknown): { code: number; message: string } {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const o = err as { code: unknown; message: unknown };
    return { code: Number(o.code) || -32000, message: String(o.message) };
  }
  return { code: -32000, message: typeof err === 'string' ? err : String(err ?? 'Unknown error') };
}

async function forwardToApi(method: string, params?: unknown): Promise<unknown> {
  const url = new URL(API_URL);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params: params || {},
    id: Date.now(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body)),
  };

  if (ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${ACCESS_TOKEN}`;
  } else if (!API_URL.includes('localhost')) {
    log('WARNING: CONTEXT_ACCESS_TOKEN not set. Requests to deployed API may fail with 401.');
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: API_PATH.startsWith('/') ? API_PATH : `/${API_PATH}`,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            // 4xx/5xx: treat as error so we send proper JSON-RPC format
            if (res.statusCode && res.statusCode >= 400) {
              const msg =
                parsed?.error && typeof parsed.error === 'string'
                  ? parsed.error
                  : parsed?.message || `HTTP ${res.statusCode}`;
              reject(new Error(msg));
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${TIMEOUT_MS}ms`));
    });

    req.write(body);
    req.end();
  });
}

async function handleLine(line: string): Promise<void> {
  let request: { method?: string; params?: unknown; id?: unknown };
  try {
    request = JSON.parse(line);
  } catch {
    log('Invalid JSON received');
    return;
  }

  const { method, params, id } = request;

  if (id === undefined) return;

  if (method === 'tools/list') {
    try {
      const apiRes = (await forwardToApi('tools/list')) as { result?: unknown; error?: { code: number; message: string } };
      const result = apiRes.result !== undefined ? apiRes.result : apiRes;
      if (apiRes.error) {
        sendResponse({ jsonrpc: '2.0', id, error: toJsonRpcError(apiRes.error) });
      } else {
        sendResponse({ jsonrpc: '2.0', id, result });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`tools/list error: ${msg}`);
      sendResponse({ jsonrpc: '2.0', id, error: { code: -32000, message: msg } });
    }
    return;
  }

  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: Record<string, unknown> };
    try {
      const apiRes = (await forwardToApi('tools/call', p)) as { result?: unknown; error?: { code: number; message: string } };
      const result = apiRes.result !== undefined ? apiRes.result : apiRes;
      if (apiRes.error) {
        sendResponse({ jsonrpc: '2.0', id, error: toJsonRpcError(apiRes.error) });
      } else {
        sendResponse({ jsonrpc: '2.0', id, result });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`tools/call error: ${msg}`);
      sendResponse({ jsonrpc: '2.0', id, error: { code: -32000, message: msg } });
    }
    return;
  }

  // Pass through other methods (initialize, etc.) - respond with minimal support
  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'context-proxy', version: '1.0.0' },
      },
    });
    return;
  }

  log(`Unknown method: ${method}`);
  sendResponse({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
}

rl.on('line', (line) => {
  handleLine(line).catch((err) => {
    log(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  });
});
