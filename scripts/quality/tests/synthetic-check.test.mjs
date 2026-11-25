import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { probe, runProbes } from '../synthetic-check.mjs';

let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.end('SECRET-BODY');
    } else if (req.url === '/down') {
      res.statusCode = 503;
      res.end('unavailable');
    } else {
      setTimeout(() => res.end('late'), 1500);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('probe marks 2xx as ok and never exposes the body', async () => {
  const result = await probe(`${base}/ok`, { timeoutMs: 1000 });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.error, null);
  assert.equal(result.event, 'synthetic.probe');
  assert.ok(!JSON.stringify(result).includes('SECRET-BODY'));
  assert.equal(typeof result.durationMs, 'number');
});

test('probe marks non-2xx and timeouts as failed', async () => {
  const down = await probe(`${base}/down`, { timeoutMs: 1000 });
  assert.deepEqual([down.ok, down.status], [false, 503]);
  const slow = await probe(`${base}/slow`, { timeoutMs: 200 });
  assert.equal(slow.ok, false);
  assert.equal(slow.status, null);
  assert.equal(slow.error, 'timeout');
});

test('runProbes appends JSONL per day and reports the last result per target', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-synthetic-'));
  try {
    const { results, last } = await runProbes({
      targets: [`${base}/ok`, `${base}/down`],
      count: 2,
      intervalS: 0.05,
      timeoutMs: 1000,
      outDir: dir,
    });
    assert.equal(results.length, 4);
    assert.equal(last.get(`${base}/ok`).ok, true);
    assert.equal(last.get(`${base}/down`).ok, false);
    const files = fs.readdirSync(dir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^synthetic-\d{4}-\d{2}-\d{2}\.jsonl$/);
    const lines = fs
      .readFileSync(path.join(dir, files[0]), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(lines.length, 4);
    assert.deepEqual(Object.keys(lines[0]), [
      'ts',
      'event',
      'target',
      'ok',
      'status',
      'durationMs',
      'error',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runProbes stops on abort', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-synthetic-'));
  try {
    const controller = new AbortController();
    const task = runProbes({
      targets: [`${base}/ok`],
      count: Infinity,
      intervalS: 0.05,
      outDir: dir,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 250);
    const { results } = await task;
    assert.ok(results.length >= 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
