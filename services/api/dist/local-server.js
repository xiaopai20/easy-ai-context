"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const lambda_1 = require("./lambda");
const PORT = process.env.PORT || 3013;
function toEvent(req, body) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const method = req.method || 'GET';
    return {
        version: '2.0',
        routeKey: `${method} ${url.pathname}`,
        rawPath: url.pathname,
        rawQueryString: url.search.substring(1),
        headers: req.headers || {},
        requestContext: {
            accountId: 'local',
            apiId: 'local',
            domainName: 'localhost',
            domainPrefix: 'local',
            http: {
                method,
                path: url.pathname,
                protocol: 'HTTP/1.1',
                sourceIp: '127.0.0.1',
                userAgent: req.headers['user-agent'] || '',
            },
            requestId: `local-${Date.now()}`,
            routeKey: `${method} ${url.pathname}`,
            stage: 'local',
            time: new Date().toISOString(),
            timeEpoch: Date.now(),
        },
        pathParameters: undefined,
        queryStringParameters: Object.fromEntries(url.searchParams.entries()) || undefined,
        body: body || undefined,
        isBase64Encoded: false,
    };
}
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}
const server = http_1.default.createServer(async (req, res) => {
    try {
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3002');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.end();
            return;
        }
        const body = await parseBody(req);
        const event = toEvent(req, body);
        const response = await (0, lambda_1.handler)(event);
        const result = typeof response === 'object' ? response : { statusCode: 200, body: response };
        res.statusCode = result.statusCode ?? 200;
        if (result.headers) {
            for (const [k, v] of Object.entries(result.headers)) {
                if (typeof v === 'string')
                    res.setHeader(k, v);
            }
        }
        res.end(result.body ?? '');
    }
    catch (err) {
        console.error('Server error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});
server.listen(PORT, () => {
    console.log(`Context API running at http://localhost:${PORT}`);
});
//# sourceMappingURL=local-server.js.map