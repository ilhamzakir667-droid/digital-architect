'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { server, transporter } = require('../server');

let baseUrl;
let sendCount = 0;

before(async () => {
    transporter.sendMail = async () => { sendCount += 1; return { accepted: ['test@example.com'] }; };
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

const payload = {
    name: 'Тест',
    contact: '@test',
    message: 'Тестовая заявка',
    consent: true,
    consentVersion: '2026-09-01',
    consentAt: '2026-11-03T12:00:00.000Z',
    website: ''
};

async function submit(body, origin = 'https://digrix.tech') {
    return fetch(baseUrl + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(body)
    });
}

test('health endpoint replies without personal data', async () => {
    const response = await fetch(baseUrl + '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
});

test('unapproved browser origins are refused', async () => {
    const response = await submit(payload, 'https://phishing.example');
    assert.equal(response.status, 403);
    assert.equal(sendCount, 0);
});

test('invalid consent never sends an email', async () => {
    const response = await submit({ ...payload, consent: false });
    assert.equal(response.status, 422);
    assert.equal(sendCount, 0);
});

test('valid contact details are sent once', async () => {
    const response = await submit(payload);
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(sendCount, 1);
});
