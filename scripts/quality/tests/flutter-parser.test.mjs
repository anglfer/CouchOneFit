import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  extractExpectedActual,
  parseFlutterMachine,
} from '../lib/flutter-machine.mjs';
import { loadCatalog } from '../lib/records.mjs';

const fixture = fs.readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'flutter-machine.jsonl'),
  'utf8'
);
const ctx = {
  runId: 'r1',
  suite: 'mobile',
  environment: 'local',
  commit: 'abc',
};
const parse = (text = fixture) =>
  parseFlutterMachine(text, {
    ctx,
    catalog: loadCatalog(),
    repoRoot: '/repo',
  });

test('hidden successful loading tests are not recorded', () => {
  const { records } = parse();
  assert.ok(
    !records.some(
      (r) => r.fullName === 'loading apps/mobile/test/api_config_test.dart'
    )
  );
  assert.equal(records.filter((r) => r.status === 'aprobada').length, 2);
});

test('passed, failed and skipped tests map to Spanish statuses', () => {
  const { records } = parse();
  const byName = Object.fromEntries(records.map((r) => [r.fullName, r]));
  assert.equal(
    byName['the environment file is bundled and readable at startup'].status,
    'aprobada'
  );
  assert.equal(byName['not ready yet'].status, 'omitida');
  const failed = byName['rejects malformed URLs'];
  assert.equal(failed.status, 'fallida');
  assert.equal(failed.expected, '<3>');
  assert.equal(failed.actual, '<2>');
  assert.match(failed.errorMessage, /Expected: <3>/);
  assert.equal(failed.durationMs, 29);
  assert.equal(failed.file, 'apps/mobile/test/api_config_test.dart');
  assert.equal(failed.suite, 'mobile');
});

test('named groups are nested in fullName without duplicating the prefix', () => {
  const { records } = parse();
  const grouped = records.find((r) => r.name === 'valida el correo');
  assert.ok(grouped);
  assert.equal(grouped.fullName, 'Cuenta > valida el correo');
  assert.equal(grouped.status, 'aprobada');
});

test('a failed hidden loading test records the file as fallida', () => {
  const { records, parser } = parse();
  const loading = records.find(
    (r) => r.file === 'apps/mobile/test/broken_test.dart'
  );
  assert.ok(loading);
  assert.equal(loading.status, 'fallida');
  assert.match(loading.name, /broken_test\.dart/);
  assert.match(loading.errorMessage, /Compilation failed/);
  assert.equal(parser.success, false);
});

test('BOM, blank lines and non-JSON noise are ignored', () => {
  const { records } = parse(`﻿noise\n${fixture}\n[1,2]\n{broken`);
  assert.equal(records.length, 5);
});

test('expected/actual extraction falls back to null without a matcher text', () => {
  assert.equal(extractExpectedActual('Exception: boom'), null);
  assert.deepEqual(
    extractExpectedActual('Expected: <1>\n  Actual: <2>\n   Which: x'),
    {
      expected: '<1>',
      actual: '<2>',
    }
  );
});
