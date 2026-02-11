#!/usr/bin/env node
/**
 * MCP stdio proxy for Cursor.
 * Forwards MCP tool calls to the deployed AWS API with Authorization header.
 *
 * Usage:
 *   CONTEXT_API_URL=https://xxx.execute-api.region.amazonaws.com
 *   CONTEXT_ACCESS_TOKEN=<cognito-access-token>
 *   npx tsx src/index.ts
 *
 * Or add to Cursor mcp.json:
 *   { "command": "npx", "args": ["tsx", "/path/to/proxy/src/index.ts"], "env": { "CONTEXT_API_URL": "...", "CONTEXT_ACCESS_TOKEN": "..." } }
 */

import * as readline from 'readline';
import * as https from 'https';
import * as http from 'http';

const API_URL = process.env.CONTEXT_API_URL || 'http://localhost:3010';
const ACCESS_TOKEN = process.env.CONTEXT_ACCESS_TOKEN || '';
const TIMEOUT_MS = parseInt(process.env.CONTEXT_TIMEOUT_MS || '30000', 10);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function log(msg: string): void {
  console.error(`[context-proxy] ${msg}`);
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
        path: '/mcp',
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
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

  if (method === 'tools/list') {
    try {
      const apiRes = (await forwardToApi('tools/list')) as { result?: unknown; error?: { code: number; message: string } };
      const result = apiRes.result !== undefined ? apiRes.result : apiRes;
      if (apiRes.error) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, error: apiRes.error }));
      } else {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`tools/list error: ${msg}`);
      console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: msg } }));
    }
    return;
  }

  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: Record<string, unknown> };
    try {
      const apiRes = (await forwardToApi('tools/call', p)) as { result?: unknown; error?: { code: number; message: string } };
      const result = apiRes.result !== undefined ? apiRes.result : apiRes;
      if (apiRes.error) {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, error: apiRes.error }));
      } else {
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`tools/call error: ${msg}`);
      console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: msg } }));
    }
    return;
  }

  // Pass through other methods (initialize, etc.) - respond with minimal support
  if (method === 'initialize') {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'context-proxy', version: '1.0.0' },
      },
    }));
    return;
  }

  log(`Unknown method: ${method}`);
  console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }));
}

rl.on('line', (line) => {
  handleLine(line).catch((err) => {
    log(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  });
});
