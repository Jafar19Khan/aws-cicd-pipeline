'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');

const VERSION = {
  build: '42',
  commit: 'abc1234',
  builtAt: '2026-10-03T10:00:00Z',
  startedAt: '2026-10-03T10:01:00Z',
  node: 'v22.0.0',
};

async function withServer(fn) {
  const server = createApp({ version: VERSION });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`, port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function sendJson(url, body, method = 'POST') {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: rawPath }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      })
      .on('error', reject);
  });
}

test('GET /health returns healthy', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'healthy' });
  });
});

test('GET /api/version reports build details', async () => {
  await withServer(async (base) => {
    const body = await (await fetch(`${base}/api/version`)).json();
    assert.equal(body.build, '42');
    assert.equal(body.commit, 'abc1234');
    assert.equal(typeof body.uptimeSeconds, 'number');
  });
});

test('task API supports create, list, update and delete', async () => {
  await withServer(async (base) => {
    const created = await sendJson(`${base}/api/tasks`, { title: 'Deploy to EC2' });
    assert.equal(created.status, 201);

    const list = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(list.length, 1);

    const put = await sendJson(`${base}/api/tasks/1`, { done: true }, 'PUT');
    assert.equal((await put.json()).done, true);

    const del = await fetch(`${base}/api/tasks/1`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal((await fetch(`${base}/api/tasks/1`)).status, 404);
  });
});

test('invalid task input returns 400', async () => {
  await withServer(async (base) => {
    const res = await sendJson(`${base}/api/tasks`, { title: '' });
    assert.equal(res.status, 400);
  });
});

test('the website is served with security headers', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await res.text(), /Dockside/);
  });
});

test('static assets are served with the right content type', async () => {
  await withServer(async (base) => {
    const css = await fetch(`${base}/style.css`);
    assert.match(css.headers.get('content-type'), /text\/css/);
    const js = await fetch(`${base}/app.js`);
    assert.match(js.headers.get('content-type'), /javascript/);
  });
});

test('paths outside the public folder are not served', async () => {
  await withServer(async (base, port) => {
    assert.equal(await rawGet(port, '/%2e%2e/package.json'), 404);
    assert.equal(await rawGet(port, '/../../etc/passwd'), 404);
    assert.equal((await fetch(`${base}/src/app.js`)).status, 404);
  });
});

test('unknown routes return 404', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });
});
