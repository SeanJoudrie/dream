import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BadRequest, buildUserMessage, createAI } from './ai.js';
import { fakeAI } from './fake-ai.js';
import { createSyncStore } from './sync.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, '../public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const TASKS = new Set(['tidy', 'repeats', 'who', 'month', 'ask', 'image']);

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string';
  res.writeHead(status, {
    'content-type': json ? 'application/json' : 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(json ? JSON.stringify(body) : body);
}

async function readJSON(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('bad json'), { status: 400 });
  }
}

export function createApp({ ai, sync }) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/ai' && req.method === 'POST') {
        if (!ai) return send(res, 503, { error: 'ai-unavailable' });
        const { task, input } = await readJSON(req, 2_000_000);
        if (!TASKS.has(task)) return send(res, 400, { error: 'unknown task' });
        buildUserMessage(task, input); // validate before spending anything
        return send(res, 200, await ai(task, input));
      }

      if (url.pathname === '/api/sync') {
        const key = req.headers['x-sync-key'];
        if (req.method === 'GET') return send(res, 200, await sync.get(key));
        if (req.method === 'PUT') return send(res, 200, await sync.put(key, await readJSON(req, 20_000_000)));
        if (req.method === 'DELETE') {
          await sync.erase(key);
          return send(res, 200, { ok: true });
        }
        return send(res, 405, { error: 'method' });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
      return serveStatic(url.pathname, res);
    } catch (e) {
      if (e instanceof BadRequest) return send(res, 400, { error: e.message });
      const status = e.status && e.status < 500 ? e.status : 502;
      if (status >= 500) console.error(`[${url.pathname}]`, e.message);
      return send(res, status, { error: status === 422 ? 'declined' : e.message });
    }
  };
}

async function serveStatic(pathname, res) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC + '/')) return send(res, 403, 'forbidden');
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // The service worker handles offline; the network copy should always be fresh.
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    send(res, 404, 'not found');
  }
}

function pickAI() {
  if (process.env.DREAM_FAKE_AI === '1') {
    console.log('AI: stand-in (DREAM_FAKE_AI=1) — output is mechanical, not real');
    return fakeAI;
  }
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return createAI();
  }
  console.log('AI: off — set ANTHROPIC_API_KEY to enable tidying, Explore and image prompts');
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  const sync = createSyncStore(process.env.DREAM_DATA || resolve(here, '../data/sync'));
  createServer(createApp({ ai: pickAI(), sync })).listen(port, () => {
    console.log(`Dream Journal on http://localhost:${port}`);
  });
}
