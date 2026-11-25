// Reporter de node:test que anexa un registro JSONL por prueba terminada.
// Se usa junto a `spec` (no emite nada por stdout). Escribe de forma
// incremental en QUALITY_RESULTS_FILE para sobrevivir a caídas del proceso.
import fs from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';
import { truncate } from './lib/common.mjs';
import {
  contextFromEnv,
  loadCatalog,
  makeRecord,
  repoRelative,
} from './lib/records.mjs';

const DEFAULT_EXPECTED = 'La prueba finaliza sin errores';

function show(value) {
  return truncate(inspect(value, { depth: 2, breakLength: 120 }), 500);
}

// Devuelve expected/actual/errorMessage a partir del error de node:test.
export function describeError(error) {
  const cause =
    error?.cause && typeof error.cause === 'object' ? error.cause : null;
  const source = cause ?? error;
  const rawMessage = cause?.message ?? error?.message ?? String(error ?? '');
  const code = source?.code;
  const message = code ? `[${code}] ${rawMessage}` : rawMessage;
  const hasValues =
    source &&
    typeof source === 'object' &&
    ('expected' in source || 'actual' in source) &&
    source.name?.includes('AssertionError');
  return {
    expected: hasValues ? show(source.expected) : DEFAULT_EXPECTED,
    actual: hasValues ? show(source.actual) : message,
    errorMessage: truncate(message, 2000),
  };
}

export default async function* qualityReporter(source) {
  const ctx = contextFromEnv();
  const catalog = loadCatalog(ctx.catalogFile);
  const namesByFile = new Map();

  const nameStack = (file) => {
    if (!namesByFile.has(file)) namesByFile.set(file, []);
    return namesByFile.get(file);
  };

  const write = (record) => {
    if (!ctx.resultsFile) return;
    fs.mkdirSync(path.dirname(ctx.resultsFile), { recursive: true });
    fs.appendFileSync(ctx.resultsFile, `${JSON.stringify(record)}\n`);
  };

  const finish = (event, failed) => {
    const data = event.data;
    const file = data.file ?? '';
    const stack = nameStack(file);
    stack[data.nesting ?? 0] = data.name;
    stack.length = (data.nesting ?? 0) + 1;
    const isSuite = data.details?.type === 'suite';
    const error = data.details?.error;
    // Las suites solo informan fallos de sus hooks; si fallaron sus subpruebas
    // ya se registraron individualmente.
    if (
      isSuite &&
      !(failed && error && error.failureType !== 'subtestsFailed')
    ) {
      return;
    }
    const isFileLevel =
      !file || data.name === file || data.name === path.basename(file);
    if (failed && error?.failureType === 'subtestsFailed') return;
    const repoFile = file ? repoRelative(file) : '';
    // A nivel de archivo Node usa la ruta absoluta: se publica la relativa.
    const name = isFileLevel ? repoFile || data.name : data.name;
    const fullName = isFileLevel ? name : stack.join(' > ');
    const skipped = Boolean(data.skip || data.todo);
    const status = failed ? 'fallida' : skipped ? 'omitida' : 'aprobada';
    const details = failed ? describeError(error) : null;
    write(
      makeRecord(ctx, catalog, {
        name,
        fullName,
        file: repoFile,
        status,
        durationMs: data.details?.duration_ms ?? 0,
        expected: details?.expected ?? DEFAULT_EXPECTED,
        actual: details?.actual,
        errorMessage: details?.errorMessage,
      })
    );
  };

  for await (const event of source) {
    if (event.type === 'test:start') {
      const stack = nameStack(event.data.file ?? '');
      stack[event.data.nesting ?? 0] = event.data.name;
      stack.length = (event.data.nesting ?? 0) + 1;
    } else if (event.type === 'test:pass') {
      finish(event, false);
    } else if (event.type === 'test:fail') {
      finish(event, true);
    }
  }
}
