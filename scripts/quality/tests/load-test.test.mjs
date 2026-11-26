import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
  assertAllowedBase,
  buildC02Steps,
  createWebSession,
  runLoad,
  runPaced,
  runScenario,
  weightedPicker,
} from '../load-test.mjs';

let server;
let base;
let failing = false;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/api/health/ready' && failing) {
      res.statusCode = 503;
    }
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('a scenario measures requests, latency and throughput', async () => {
  const result = await runScenario({
    base,
    scenario: 'health',
    concurrency: 3,
    durationS: 0.4,
  });
  assert.equal(result.event, 'load.scenario');
  assert.equal(result.path, '/api/health');
  assert.equal(result.method, 'GET');
  assert.equal(result.concurrency, 3);
  assert.ok(result.requests > 0);
  assert.equal(result.errors, 0);
  assert.equal(result.errorRate, 0);
  assert.ok(result.throughputRps > 0);
  const { mean, p50, p95, p99, max } = result.latencyMs;
  assert.ok(p50 <= p95 && p95 <= p99 && p99 <= max && mean > 0);
});

test('non-2xx responses and network failures count as errors', async () => {
  failing = true;
  const bad = await runScenario({
    base,
    scenario: 'ready',
    concurrency: 2,
    durationS: 0.3,
  });
  failing = false;
  assert.equal(bad.errors, bad.requests);
  assert.equal(bad.errorRate, 100);
  const refused = await runScenario({
    base: 'http://127.0.0.1:1',
    scenario: 'plans',
    concurrency: 1,
    durationS: 0.2,
  });
  assert.equal(refused.errors, refused.requests);
});

test('runLoad writes one JSONL record per scenario', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-load-'));
  try {
    const outFile = path.join(dir, 'load.jsonl');
    const results = await runLoad({
      base,
      scenarios: ['health', 'plans'],
      concurrency: 2,
      durationS: 0.2,
      outFile,
    });
    assert.equal(results.length, 2);
    const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n');
    assert.deepEqual(
      lines.map((line) => JSON.parse(line).scenario),
      ['health', 'plans']
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('remote hosts are refused unless explicitly allowed', async () => {
  assert.throws(
    () => assertAllowedBase('https://api.example.com'),
    /localhost/
  );
  assert.doesNotThrow(() => assertAllowedBase('http://localhost:3000'));
  assert.doesNotThrow(() => assertAllowedBase('http://[::1]:3000'));
  assert.doesNotThrow(() =>
    assertAllowedBase('https://api.example.com', { allowRemote: true })
  );
  await assert.rejects(
    runLoad({ base: 'https://api.example.com', durationS: 0.1 }),
    /localhost/
  );
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('weightedPicker splits steps exactly by weight', () => {
  const pick = weightedPicker([
    { name: 'a', weight: 1 },
    { name: 'b', weight: 1 },
    { name: 'w', weight: 2 },
  ]);
  const counts = { a: 0, b: 0, w: 0 };
  for (let i = 0; i < 400; i += 1) counts[pick().name] += 1;
  assert.deepEqual(counts, { a: 100, b: 100, w: 200 });
});

test('paced mode keeps the arrival rate and reports per-type stats', async () => {
  const result = await runPaced({
    rps: 50,
    concurrency: 15,
    durationS: 0.6,
    steps: [
      { name: 'r', type: 'read', weight: 1, run: async () => ({ ok: true }) },
      { name: 'w', type: 'write', weight: 1, run: async () => ({ ok: true }) },
    ],
  });
  assert.equal(result.event, 'load.paced');
  assert.ok(result.arrivals >= 28 && result.arrivals <= 32, String(result.arrivals));
  assert.ok(result.achievedRps > 40 && result.achievedRps < 60);
  assert.equal(result.delayed, 0);
  assert.equal(result.read.samples + result.write.samples, result.arrivals);
  assert.ok(Math.abs(result.read.samples - result.write.samples) <= 1);
  for (const stats of [result.read, result.write]) {
    assert.equal(stats.errors, 0);
    assert.equal(stats.errorRate, 0);
    assert.ok(stats.p50 <= stats.p95 && stats.p95 <= stats.p99);
  }
});

test('paced mode honors the in-flight cap and counts delayed arrivals', async () => {
  let active = 0;
  let peak = 0;
  const result = await runPaced({
    rps: 100,
    concurrency: 3,
    durationS: 0.4,
    steps: [
      {
        name: 'slow',
        type: 'read',
        weight: 1,
        run: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await sleep(60);
          active -= 1;
          return { ok: true };
        },
      },
    ],
  });
  assert.ok(peak <= 3, `peak ${peak}`);
  assert.equal(result.maxInFlight, 3);
  assert.ok(result.delayed > 0);
  assert.equal(result.read.samples, result.arrivals);
  assert.ok(result.read.p95 >= 55);
});

test('paced mode counts failed and thrown steps as errors', async () => {
  const result = await runPaced({
    rps: 40,
    concurrency: 5,
    durationS: 0.3,
    steps: [
      { name: 'bad', type: 'write', weight: 1, run: async () => ({ ok: false }) },
      {
        name: 'boom',
        type: 'read',
        weight: 1,
        run: async () => {
          throw new Error('x');
        },
      },
    ],
  });
  assert.equal(result.write.errors, result.write.samples);
  assert.equal(result.read.errorRate, 100);
  await assert.rejects(runPaced({ steps: [], durationS: 0.1 }), /paso/);
});

test('web session sends cookies and CSRF; C-02 steps mix 50/50 and track versions', async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    const { pathname } = new URL(url);
    calls.push({ pathname, ...init });
    const headers = new Headers();
    if (pathname === '/api/auth/csrf') {
      headers.append('set-cookie', 'cof_csrf=tok; Path=/api; HttpOnly');
      return new Response(JSON.stringify({ csrfToken: 'tok' }), { headers });
    }
    if (pathname === '/api/auth/login') {
      headers.append('set-cookie', 'cof_access=acc; Path=/api; HttpOnly');
      return new Response('{}', { headers });
    }
    if (init.method === 'PATCH') {
      const { version } = JSON.parse(init.body);
      return new Response(JSON.stringify({ client: { version: version + 1 } }));
    }
    return new Response('{}');
  };
  const session = await createWebSession({
    base: 'http://127.0.0.1:1',
    origin: 'http://localhost:5000',
    username: 'u',
    password: 'p',
    fetchImpl: fakeFetch,
  });
  const result = await runPaced({
    rps: 80,
    concurrency: 15,
    durationS: 0.4,
    steps: buildC02Steps({ session, clientIds: ['c1', 'c2'] }),
  });
  assert.equal(result.read.errors + result.write.errors, 0);
  assert.ok(Math.abs(result.read.samples - result.write.samples) <= 1);
  const patches = calls.filter((c) => c.method === 'PATCH');
  assert.ok(patches.length > 2);
  assert.ok(patches.every((c) => c.headers['X-CSRF-Token'] === 'tok'));
  assert.ok(patches.every((c) => c.headers.Origin === 'http://localhost:5000'));
  assert.ok(patches.every((c) => /cof_access=acc/.test(c.headers.Cookie)));
  const versions = patches
    .filter((c) => c.pathname.endsWith('/c1'))
    .map((c) => JSON.parse(c.body).version);
  assert.deepEqual(
    versions,
    versions.map((_, i) => i + 1)
  );
});
