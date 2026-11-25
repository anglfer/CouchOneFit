import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const reporter = pathToFileURL(
  path.join(root, 'scripts', 'quality', 'node-test-reporter.mjs')
).href;
const fixtureDir = 'scripts/quality/tests/fixtures/node-suite';

function runFixture(file, runId = 'run-a') {
  // Sin NODE_TEST_CONTEXT el proceso hijo actúa como ejecutor raíz.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-reporter-'));
  const resultsFile = path.join(dir, 'results.jsonl');
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      `--test-reporter=${reporter}`,
      '--test-reporter-destination=stdout',
      `${fixtureDir}/${file}`,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...env,
        QUALITY_RUN_ID: runId,
        QUALITY_SUITE: 'quality',
        QUALITY_ENVIRONMENT: 'local',
        QUALITY_COMMIT: 'abc123',
        QUALITY_RESULTS_FILE: resultsFile,
      },
    }
  );
  const records = fs.existsSync(resultsFile)
    ? fs
        .readFileSync(resultsFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  fs.rmSync(dir, { recursive: true, force: true });
  return { result, records };
}

test('the reporter yields no stdout and records every finished test', () => {
  const { result, records } = runFixture('sample.fixture.mjs');
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.trim(), '');
  const byName = Object.fromEntries(records.map((r) => [r.fullName, r]));
  assert.deepEqual(Object.keys(byName).sort(), [
    'fails with deepStrictEqual',
    'is skipped',
    'outer > inner > nested passes',
    'outer > inner > nested throws',
    'passes',
  ]);
  assert.equal(byName.passes.status, 'aprobada');
  assert.equal(byName.passes.errorMessage, null);
  assert.equal(byName.passes.actual, 'Sin errores');
  assert.equal(byName['is skipped'].status, 'omitida');
  assert.equal(byName['outer > inner > nested passes'].name, 'nested passes');
  const failed = byName['fails with deepStrictEqual'];
  assert.equal(failed.status, 'fallida');
  assert.match(failed.expected, /total: 3/);
  assert.match(failed.actual, /total: 2/);
  assert.match(failed.errorMessage, /Expected values to be strictly/);
  const thrown = byName['outer > inner > nested throws'];
  assert.equal(thrown.status, 'fallida');
  assert.equal(thrown.expected, 'La prueba finaliza sin errores');
  assert.equal(thrown.actual, 'boom');
  assert.equal(thrown.errorMessage, 'boom');
});

test('records follow the exact schema and carry the run context', () => {
  const { records } = runFixture('sample.fixture.mjs', 'run-schema');
  assert.deepEqual(Object.keys(records[0]), [
    'runId',
    'suite',
    'testId',
    'name',
    'fullName',
    'file',
    'module',
    'type',
    'requirements',
    'timestamp',
    'durationMs',
    'expected',
    'actual',
    'status',
    'errorMessage',
    'environment',
    'commit',
  ]);
  const record = records[0];
  assert.equal(record.runId, 'run-schema');
  assert.equal(record.commit, 'abc123');
  assert.equal(record.file, `${fixtureDir}/sample.fixture.mjs`);
  assert.equal(record.module, 'Sin clasificar');
  assert.ok(!Number.isNaN(Date.parse(record.timestamp)));
  assert.equal(typeof record.durationMs, 'number');
});

test('testId is stable across runs and different per test', () => {
  const first = runFixture('sample.fixture.mjs', 'run-1').records;
  const second = runFixture('sample.fixture.mjs', 'run-2').records;
  const ids = (list) =>
    Object.fromEntries(list.map((r) => [r.fullName, r.testId]));
  assert.deepEqual(ids(first), ids(second));
  assert.equal(new Set(Object.values(ids(first))).size, first.length);
  assert.match(first[0].testId, /^quality:[0-9a-f]{12}$/);
});

test('a file that cannot load is recorded as fallida', () => {
  const { result, records } = runFixture('syntax.fixture.mjs');
  assert.notEqual(result.status, 0);
  assert.ok(records.length >= 1);
  assert.ok(records.every((r) => r.status === 'fallida'));
  assert.ok(records.some((r) => r.fullName.includes('syntax.fixture.mjs')));
  // Sin rutas absolutas de la máquina (usuario local) en los registros.
  for (const r of records) {
    assert.ok(!/^[A-Za-z]:[\\/]|^\//.test(r.name), r.name);
    assert.ok(!/^[A-Za-z]:[\\/]|^\//.test(r.fullName), r.fullName);
  }
});
