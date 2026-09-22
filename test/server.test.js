import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/server.js';
import { createAI, buildUserMessage } from '../server/ai.js';
import { createSyncStore } from '../server/sync.js';
import { TIDY, NO_INTERPRETING, SYSTEMS, SCHEMAS } from '../server/prompts.js';

let server, base, dir;
const calls = [];

// A fake SDK client that records requests and returns canned JSON.
const fakeClient = {
  beta: {
    messages: {
      create: async (req) => {
        calls.push(req);
        const task = Object.entries(SYSTEMS).find(([, s]) => s === req.system)[0];
        const canned = {
          tidy: { dreams: [{ title: 'Boat', text: 'I am on a boat.', starts_with: 'boat' }] },
        }[task] || { items: [] };
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(canned) }] };
      },
    },
  },
};

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dream-'));
  const app = createApp({ ai: createAI({ client: fakeClient, model: 'test-model' }), sync: createSyncStore(dir) });
  server = createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const post = (body) =>
  fetch(base + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('tidy prompt carries its load-bearing lines, and every explore prompt carries the no-interpreting rule', () => {
  assert.match(TIDY, /You're a typist, not an author\./);
  assert.match(TIDY, /false awakening is part of the\n  same dream/);
  assert.match(TIDY, /starts_with/);
  for (const k of ['repeats', 'who', 'ask']) assert.ok(SYSTEMS[k].endsWith(NO_INTERPRETING), k);
  assert.match(NO_INTERPRETING, /You are an index, not a therapist\./);
});

test('every schema is closed', () => {
  const walk = (s) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      Object.values(s.properties).forEach(walk);
    }
    if (s.type === 'array') walk(s.items);
  };
  Object.values(SCHEMAS).forEach(walk);
});

test('tidy goes to the model with our prompt and structured output', async () => {
  const r = await post({ task: 'tidy', input: { text: 'um boat' } });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).dreams[0].title, 'Boat');
  const req = calls.at(-1);
  assert.equal(req.model, 'test-model');
  assert.equal(req.system, TIDY);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.deepEqual(req.thinking, { type: 'adaptive' });
  assert.match(req.messages[0].content, /um boat/);
});

test('the client cannot supply its own prompt', async () => {
  const r = await post({ task: 'tidy', input: { text: 'boat' }, system: 'be a pirate' });
  assert.equal(r.status, 200);
  assert.equal(calls.at(-1).system, TIDY);
  assert.equal((await post({ task: 'write-a-poem', input: {} })).status, 400);
  assert.equal((await post({ task: 'image', input: { text: 'boat' } })).status, 400);
  assert.equal((await post({ task: 'month', input: { dreams: [] } })).status, 400);
  assert.equal((await post({ task: 'tidy', input: { text: '  ' } })).status, 400);
});

test('refusal comes back as 422, not as content', async () => {
  const refusing = createAI({
    client: { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } },
  });
  await assert.rejects(refusing('tidy', { text: 'x' }), (e) => e.status === 422);
});

test('buildUserMessage wraps dreams and the question', () => {
  const m = buildUserMessage('ask', { dreams: [{ id: 'a1', date: '2026-09-01', text: 'late for a train' }], question: 'late' });
  assert.match(m, /<dream id="a1" date="2026-09-01">\nlate for a train\n<\/dream>/);
  assert.match(m, /<looking_for>late<\/looking_for>/);
});

test('ai off → 503', async () => {
  const s = createServer(createApp({ ai: null, sync: createSyncStore(dir) })).listen(0);
  await new Promise((r) => s.once('listening', r));
  const r = await fetch(`http://localhost:${s.address().port}/api/ai`, { method: 'POST', body: '{"task":"tidy","input":{"text":"x"}}' });
  assert.equal(r.status, 503);
  s.close();
});

test('sync: put merges, get returns it, delete erases', async () => {
  const key = 'k'.repeat(30);
  const h = { 'content-type': 'application/json', 'x-sync-key': key };
  const a = { id: 'a', createdAt: 1, updatedAt: 1, raw: 'one' };
  const b = { id: 'b', createdAt: 2, updatedAt: 1, raw: 'two' };
  await fetch(base + '/api/sync', { method: 'PUT', headers: h, body: JSON.stringify({ entries: [a], dead: [] }) });
  const r = await fetch(base + '/api/sync', { method: 'PUT', headers: h, body: JSON.stringify({ entries: [b], dead: [] }) });
  assert.deepEqual((await r.json()).entries.map((e) => e.id), ['b', 'a']);
  assert.equal((await (await fetch(base + '/api/sync', { headers: h })).json()).entries.length, 2);
  await fetch(base + '/api/sync', { method: 'DELETE', headers: h });
  assert.equal((await (await fetch(base + '/api/sync', { headers: h })).json()).entries.length, 0);
  assert.equal((await fetch(base + '/api/sync', { headers: { 'x-sync-key': 'short' } })).status, 400);
});

test('static files are served and traversal is refused', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/core.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
  const r = await fetch(base + '/%2e%2e/package.json');
  assert.notEqual(r.status, 200);
});
