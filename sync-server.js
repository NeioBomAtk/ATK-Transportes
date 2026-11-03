const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.ATK_SYNC_PORT || 25556);
const TOKEN_FILE = path.join(__dirname, '.atk-sync-token');
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function getOrCreateToken() {
    try {
        const existing = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        if (/^[a-f0-9]{32}$/.test(existing)) return existing;
    } catch (_) {
        // First launch: create a random local pairing token.
    }

    const token = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(TOKEN_FILE, token, { encoding: 'utf8', flag: 'w' });
    return token;
}

const token = getOrCreateToken();
let latestState = null;
let latestUpdatedAt = null;

function getIpv4Addresses() {
    const addresses = [];
    for (const entries of Object.values(os.networkInterfaces())) {
        for (const entry of entries || []) {
            if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
        }
    }
    return [...new Set(addresses)];
}

function isLoopback(address) {
    const normalized = (address || '').replace(/^::ffff:/, '');
    return normalized === '127.0.0.1' || normalized === '::1';
}

function sendJson(response, status, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
    });
    response.end(body);
}

function setCors(request, response) {
    const origin = request.headers.origin;
    response.setHeader('Access-Control-Allow-Origin', origin || '*');
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ATK-Token');
    response.setHeader('Access-Control-Max-Age', '600');
    response.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        request.setEncoding('utf8');
        request.on('data', chunk => {
            size += Buffer.byteLength(chunk);
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Dados acima do limite permitido.'));
                request.destroy();
                return;
            }
            body += chunk;
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (_) {
                reject(new Error('JSON inválido.'));
            }
        });
        request.on('error', reject);
    });
}

const server = http.createServer(async (request, response) => {
    setCors(request, response);
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
        sendJson(response, 200, { ok: true });
        return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/info') {
        const origin = request.headers.origin;
        if (!isLoopback(request.socket.remoteAddress) || (origin && origin !== 'null')) {
            sendJson(response, 403, { error: 'Consulte as informações de conexão pelo app aberto neste PC.' });
            return;
        }
        sendJson(response, 200, { token, port: PORT, addresses: getIpv4Addresses() });
        return;
    }

    if (request.headers['x-atk-token'] !== token) {
        sendJson(response, 401, { error: 'Código de conexão inválido.' });
        return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/state') {
        if (!latestState) {
            sendJson(response, 404, { error: 'O app do PC ainda não publicou os dados.' });
            return;
        }
        sendJson(response, 200, { state: latestState, updatedAt: latestUpdatedAt });
        return;
    }

    if (request.method === 'PUT' && requestUrl.pathname === '/state') {
        try {
            const state = await readJsonBody(request);
            if (!state || typeof state !== 'object' || Array.isArray(state) || state.saldo === undefined) {
                sendJson(response, 400, { error: 'O estado recebido não é válido.' });
                return;
            }
            latestState = state;
            latestUpdatedAt = new Date().toISOString();
            sendJson(response, 200, { ok: true, updatedAt: latestUpdatedAt });
        } catch (error) {
            sendJson(response, 400, { error: error.message || 'Não foi possível ler os dados.' });
        }
        return;
    }

    sendJson(response, 404, { error: 'Rota não encontrada.' });
});

server.on('error', error => {
    if (error.code !== 'EADDRINUSE') console.error('Servidor de sincronização ATK:', error.message);
    process.exitCode = error.code === 'EADDRINUSE' ? 0 : 1;
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sincronização local ATK ativa na porta ${PORT}.`);
});
