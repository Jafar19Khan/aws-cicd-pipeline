'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { TaskStore, ValidationError } = require('./store');

const MAX_BODY_BYTES = 1024 * 10;
const DEFAULT_PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

/** Build and deploy details, injected by the Docker build (see Dockerfile). */
function readVersionInfo(env = process.env) {
  return {
    build: env.BUILD_NUMBER || 'local',
    commit: env.GIT_COMMIT || 'dev',
    builtAt: env.BUILD_TIME || null,
    startedAt: new Date().toISOString(),
    node: process.version,
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ValidationError('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new ValidationError('Request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Serves a file from publicDir. Returns false when there is nothing to serve. */
function serveStatic(res, publicDir, pathname) {
  try {
    let relative = decodeURIComponent(pathname);
    if (relative === '/') {
      relative = '/index.html';
    }
    const fullPath = path.join(publicDir, path.normalize(relative));
    if (!fullPath.startsWith(publicDir + path.sep)) {
      return false;
    }
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return false;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    fs.createReadStream(fullPath).pipe(res);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Creates the HTTP server: JSON API under /api, health check, and the website.
 * @param {{store?: TaskStore, publicDir?: string, version?: object}} [options]
 * @returns {http.Server}
 */
function createApp(options = {}) {
  const store = options.store || new TaskStore();
  const publicDir = path.resolve(options.publicDir || DEFAULT_PUBLIC_DIR);
  const version = options.version || readVersionInfo();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const idMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);

    try {
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { status: 'healthy' });
      }

      if (req.method === 'GET' && pathname === '/api/version') {
        return sendJson(res, 200, { ...version, uptimeSeconds: Math.round(process.uptime()) });
      }

      if (pathname === '/api/tasks') {
        if (req.method === 'GET') {
          return sendJson(res, 200, store.list());
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          return sendJson(res, 201, store.create(body));
        }
      }

      if (idMatch) {
        const id = Number(idMatch[1]);
        if (req.method === 'GET') {
          const task = store.get(id);
          return task
            ? sendJson(res, 200, task)
            : sendJson(res, 404, { error: 'Task not found' });
        }
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          const task = store.update(id, body);
          return task
            ? sendJson(res, 200, task)
            : sendJson(res, 404, { error: 'Task not found' });
        }
        if (req.method === 'DELETE') {
          return store.delete(id)
            ? sendJson(res, 200, { deleted: true })
            : sendJson(res, 404, { error: 'Task not found' });
        }
      }

      if (req.method === 'GET' && !pathname.startsWith('/api/')) {
        if (serveStatic(res, publicDir, pathname)) {
          return undefined;
        }
      }

      return sendJson(res, 404, { error: 'Route not found' });
    } catch (err) {
      if (err instanceof ValidationError) {
        return sendJson(res, 400, { error: err.message });
      }
      return sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}

module.exports = { createApp, readVersionInfo };
