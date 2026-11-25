import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from '../lib/common.mjs';
import {
  catalogEntry,
  loadCatalog,
  resolveMeta,
  SUITE_DIRS,
} from '../lib/records.mjs';

const catalog = loadCatalog();
const TEST_FILES = {
  quality: { dir: 'scripts/quality/tests', pattern: /\.test\.mjs$/ },
  api: { dir: 'apps/api/tests', pattern: /\.test\.ts$/ },
  web: { dir: 'apps/web/tests', pattern: /\.test\.mjs$/ },
  mobile: { dir: 'apps/mobile/test', pattern: /_test\.dart$/ },
};

test('every catalog key points to an existing test file', () => {
  for (const [suite, entries] of Object.entries(catalog.suites)) {
    for (const key of Object.keys(entries)) {
      const file = path.join(REPO_ROOT, SUITE_DIRS[suite], key);
      assert.ok(fs.existsSync(file), `${suite}: ${key} no existe`);
    }
  }
});

// Regresión: la suite quality buscaba rutas del repo en vez de rutas de su
// carpeta y todas sus pruebas quedaban sin clasificar.
test('every real test file resolves to its catalog entry', () => {
  for (const [suite, { dir, pattern }] of Object.entries(TEST_FILES)) {
    for (const name of fs.readdirSync(path.join(REPO_ROOT, dir))) {
      if (!pattern.test(name)) continue;
      const repoFile = `${dir}/${name}`;
      assert.ok(
        catalogEntry(catalog, suite, repoFile),
        `${suite}: ${repoFile} no está en test-catalog.json`
      );
    }
  }
  const meta = resolveMeta(
    catalog,
    'quality',
    'scripts/quality/tests/node-reporter.test.mjs'
  );
  assert.equal(meta.type, 'integración');
});
