#!/usr/bin/env npx tsx
/**
 * Fetch Cognito ID token for testing the deployed API.
 * Starts a local server, opens browser for sign-in, exchanges code for token.
 *
 * Usage (run from project root, not infra):
 *   COGNITO_DOMAIN=context-prod-xxx CLIENT_ID=xxx npx tsx scripts/get-token.ts
 *
 * Optional: COGNITO_REGION=us-east-1 (default)
 */

const REDIRECT_URI = 'http://localhost:3000';
const PORT = 3000;

async function main() {
  const domainPrefix = process.env.COGNITO_DOMAIN;
  const clientId = process.env.CLIENT_ID;
  const region = process.env.COGNITO_REGION || 'us-east-1';

  if (!domainPrefix || !clientId) {
    console.error('Set COGNITO_DOMAIN (domain prefix) and CLIENT_ID from cdk deploy output');
    console.error('Example: COGNITO_DOMAIN=context-prod-xxx CLIENT_ID=xxx npx tsx scripts/get-token.ts');
    process.exit(1);
  }

  const domain = `${domainPrefix}.auth.${region}.amazoncognito.com`;

  const authUrl = `https://${domain}/oauth2/authorize?` + new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: REDIRECT_URI,
  });

  const server = await new Promise<{ url: string }>((resolve, reject) => {
    const http = require('http');
    const srv = http.createServer(async (req: any, res: any) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      if (url.pathname === '/' && url.searchParams.has('code')) {
        const code = url.searchParams.get('code')!;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Token received. Check terminal.</h1>');
        srv.close();

        const tokenRes = await fetch(`https://${domain}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: REDIRECT_URI,
          }),
        });
        const tokens = await tokenRes.json();
        if (tokens.id_token) {
          console.log('\nID_TOKEN (use with: curl -H "Authorization: Bearer <token>" ...):\n');
          console.log(tokens.id_token);
        } else {
          console.error('Token exchange failed:', tokens);
        }
        process.exit(0);
      } else if (url.pathname === '/' && url.searchParams.has('error')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error: ${url.searchParams.get('error')}</h1>`);
        console.error('OAuth error:', url.searchParams.get('error'), url.searchParams.get('error_description'));
        process.exit(1);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Waiting for callback...</h1>');
      }
    });
    srv.listen(PORT, () => {
      resolve({ url: authUrl });
    });
  });

  console.log('Opening browser for sign-in...');
  console.log('If it does not open, visit:', authUrl);
  const { exec } = require('child_process');
  exec(`${process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'} "${authUrl}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
