import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { assertAllowedBase, runLoad, runScenario } from '../load-test.mjs';

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
