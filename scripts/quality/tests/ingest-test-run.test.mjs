import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCiBatches } from '../ingest-test-run.mjs';

const summary = {
  runId: '20261125T200000Z-abcdef',
  environment: 'ci',
  startedAt: '2026-11-25T20:00:00Z',
  finishedAt: '2026-11-25T20:00:05Z',
  durationMs: 5000,
};

test('stores every CI result in bounded, reproducible batches', () => {
  const records = Array.from({ length: 501 }, (_, index) => ({
    suite: 'api',
    testId: `case-abc-${index}`,
    name: 'Ejecuta el contrato',
    status: 'aprobada',
    durationMs: 3,
  }));

  const batches = buildCiBatches(summary, records, 'github_actions');
  const checks = batches.flatMap((batch) => batch.checks);
  assert.deepEqual(batches.map((batch) => batch.checks.length), [500, 1]);
  assert.equal(new Set(checks.map((item) => item.externalEventId)).size, records.length);
  assert.equal(batches[1].run.category, 'ci_suite');
  assert.ok(checks.every((item) => item.environment === 'ci'));
  assert.deepEqual(batches, buildCiBatches(summary, records, 'github_actions'));
});

test('keeps failed test evidence sanitized for the administrative module', () => {
  const [{ checks: [check] }] = buildCiBatches(summary, [{
    suite: 'load',
    testId: 'case-bad-result',
    name: 'Comprueba el contrato',
    file: 'C:\\ruta\\local\\interna',
    status: 'fallida',
    expected: 'Valor privado esperado',
    actual: 'Valor privado obtenido',
    errorMessage: 'Detalle privado del fallo',
  }], 'github_actions');

  assert.equal(check.checkKind, 'load_scenario');
  assert.equal(check.status, 'failed');
  assert.equal(check.errorCode, 'TEST_FAILED');
  assert.equal(check.target, null);
  assert.doesNotMatch(JSON.stringify(check), /privado|interna/);
});
