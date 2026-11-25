// Parser del formato `flutter test --machine` (JSON por línea) a registros.
import path from 'node:path';
import { truncate } from './common.mjs';
import { makeRecord, repoRelative } from './records.mjs';

const DEFAULT_EXPECTED = 'La prueba finaliza sin errores';

// Intenta extraer "Expected: ... Actual: ..." del texto de un fallo de matcher.
export function extractExpectedActual(text) {
  const match =
    /Expected:\s*([\s\S]*?)\r?\n\s*Actual:\s*([\s\S]*?)(?:\r?\n\s*Which:|\r?\n\r?\n|$)/.exec(
      text ?? ''
    );
  if (!match) return null;
  return {
    expected: truncate(match[1].trim(), 500),
    actual: truncate(match[2].trim(), 500),
  };
}

export class FlutterMachineParser {
  constructor({ ctx, catalog, repoRoot, onRecord }) {
    this.ctx = ctx;
    this.catalog = catalog;
    this.repoRoot = repoRoot;
    this.onRecord = onRecord;
    this.suites = new Map();
    this.groups = new Map();
    this.tests = new Map();
    this.sawDone = false;
    this.success = null;
    this.emitted = 0;
  }

  feedLine(rawLine) {
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line.startsWith('{')) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    switch (event.type) {
      case 'suite':
        this.suites.set(event.suite.id, event.suite.path);
        break;
      case 'group':
        this.groups.set(event.group.id, {
          name: event.group.name ?? '',
          parentID: event.group.parentID ?? null,
        });
        break;
      case 'testStart':
        this.tests.set(event.test.id, {
          name: event.test.name,
          suiteID: event.test.suiteID,
          groupIDs: event.test.groupIDs ?? [],
          start: event.time,
          skip: Boolean(event.test.metadata?.skip),
          errors: [],
        });
        break;
      case 'error': {
        const test = this.tests.get(event.testID);
        if (test) test.errors.push(event);
        break;
      }
      case 'testDone':
        this.#done(event);
        break;
      case 'done':
        this.sawDone = true;
        this.success = event.success;
        break;
      default:
    }
  }

  // Nombres de grupo no vacíos, de la raíz a la hoja.
  #groupNames(test) {
    const names = [];
    const seen = new Set();
    let id = test.groupIDs.at(-1);
    while (id !== undefined && id !== null && !seen.has(id)) {
      seen.add(id);
      const group = this.groups.get(id);
      if (!group) break;
      if (group.name) names.unshift(group.name);
      id = group.parentID;
    }
    return names;
  }

  #done(event) {
    const test = this.tests.get(event.testID);
    if (!test) return;
    const failed = event.result === 'failure' || event.result === 'error';
    if (event.hidden && !failed) return;
    const suitePath = this.suites.get(test.suiteID) ?? '';
    const file = suitePath ? repoRelative(suitePath, this.repoRoot) : '';
    const durationMs = Math.max(0, (event.time ?? 0) - (test.start ?? 0));
    const errorText = test.errors
      .map((entry) => String(entry.error ?? '').trim())
      .filter(Boolean)
      .join('\n');
    const pair = extractExpectedActual(errorText);
    let name = test.name;
    let fullName = test.name;
    if (event.hidden) {
      // Una prueba oculta que falla (p. ej. "loading <archivo>") indica que el
      // archivo no se pudo compilar o que falló un setUpAll.
      name = `${path.posix.basename(file || 'suite')}: ${
        test.name.startsWith('loading ')
          ? 'no se pudo cargar el archivo'
          : test.name
      }`;
      fullName = test.name.startsWith('loading ')
        ? `loading ${file}`
        : test.name;
    } else {
      const groups = this.#groupNames(test);
      if (groups.length) {
        const prefix = groups.join(' ');
        const short = test.name.startsWith(`${prefix} `)
          ? test.name.slice(prefix.length + 1)
          : test.name;
        name = short;
        fullName = [...groups, short].join(' > ');
      }
    }
    const status = failed
      ? 'fallida'
      : event.skipped || test.skip
        ? 'omitida'
        : 'aprobada';
    const record = makeRecord(this.ctx, this.catalog, {
      suite: 'mobile',
      name,
      fullName,
      file,
      status,
      durationMs,
      expected: pair?.expected ?? DEFAULT_EXPECTED,
      actual: pair?.actual ?? (failed ? truncate(errorText, 500) : undefined),
      errorMessage: failed
        ? truncate(errorText || `Resultado: ${event.result}`, 2000)
        : null,
    });
    this.emitted += 1;
    this.onRecord(record);
  }
}

export function parseFlutterMachine(text, options) {
  const records = [];
  const parser = new FlutterMachineParser({
    ...options,
    onRecord: (record) => records.push(record),
  });
  for (const line of text.split(/\r?\n/)) parser.feedLine(line);
  return { records, parser };
}
