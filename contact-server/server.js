'use strict';

const http = require('node:http');
const nodemailer = require('nodemailer');

const originList = (process.env.ALLOWED_ORIGINS || 'https://digrix.tech,https://www.digrix.tech')
    .split(',').map((s) => s.trim()).filter(Boolean);
const port = Number(process.env.PORT || 8080);
const maxBodyBytes = 12 * 1024;
const rateWindowMs = 10 * 60 * 1000;
const rateLimit = 5;
const requestsByIp = new Map();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function sendJson(response, status, body) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    response.end(JSON.stringify(body));
}

async function readJson(request) {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > maxBodyBytes) {
            const error = new Error('Too large');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (_) {
        const error = new Error('Invalid JSON');
        error.status = 400;
        throw error;
    }
}

function validText(value, min, max) {
    return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function rateLimitExceeded(ip) {
    const now = Date.now();
    const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < rateWindowMs);
    recent.push(now);
    requestsByIp.set(ip, recent);
    return recent.length > rateLimit;
}

const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
        return sendJson(response, 200, { ok: true });
    }

    if (request.url !== '/contact') return sendJson(response, 404, { ok: false });

    const origin = request.headers.origin;
    if (!origin || !originList.includes(origin)) {
        return sendJson(response, 403, { ok: false, error: 'Origin not allowed' });
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    if (request.method !== 'POST') return sendJson(response, 405, { ok: false });

    if ((request.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
        return sendJson(response, 415, { ok: false, error: 'JSON required' });
    }

    // Use the TCP peer IP, not untrusted X-Forwarded-For; adapt behind a trusted proxy.
    const ip = request.socket.remoteAddress || 'unknown';
    if (rateLimitExceeded(ip)) return sendJson(response, 429, { ok: false, error: 'Too many requests' });

    let data;
    try {
        data = await readJson(request);
    } catch (error) {
        return sendJson(response, error.status || 400, { ok: false, error: 'Invalid request' });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return sendJson(response, 400, { ok: false, error: 'Invalid data' });
    }

    // A hidden field traps simple bots. Never include it in the outgoing email.
    if (data.website) return sendJson(response, 200, { ok: true });

    if (!validText(data.name, 1, 100) ||
        !validText(data.contact, 3, 200) ||
        !validText(data.message, 3, 4000) ||
        data.consent !== true ||
        data.consentVersion !== '2026-09-01' ||
        typeof data.consentAt !== 'string' ||
        !Number.isFinite(Date.parse(data.consentAt))) {
        return sendJson(response, 422, { ok: false, error: 'Invalid fields or consent' });
    }

    const mailText = [
        'Новая заявка с сайта DIGRIX',
        'Имя: ' + data.name.trim(),
        'Контакт: ' + data.contact.trim(),
        '',
        'Задача:',
        data.message.trim(),
        '',
        'Согласие: подтверждено',
        'Редакция: ' + data.consentVersion,
        'Дата отметки: ' + data.consentAt
    ].join('\n');

    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to: process.env.MAIL_TO,
            subject: 'Новая заявка с digrix.tech',
            text: mailText
        });
        return sendJson(response, 202, { ok: true });
    } catch (error) {
        // Do not log personal data or credentials.
        console.error('Contact mail delivery failed:', error && error.code ? error.code : 'SMTP error');
        return sendJson(response, 503, { ok: false, error: 'Delivery unavailable' });
    }
});

if (require.main === module) {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO']) {
        if (!process.env[key]) throw new Error('Missing required environment variable: ' + key);
    }
    server.listen(port, () => console.log('DIGRIX contact receiver listening on port ' + port));
}

module.exports = { server, validText, transporter };
