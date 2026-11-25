// Catálogo de trazabilidad y construcción de registros de resultados.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT, toPosix, truncate } from './common.mjs';

export const DEFAULT_CATALOG = path.join(
  REPO_ROOT,
  'scripts',
  'quality',
  'test-catalog.json'
);

// Carpeta de cada suite respecto a la raíz del repositorio.
export const SUITE_DIRS = {
  quality: 'scripts/quality',
  api: 'apps/api',
  web: 'apps/web',
  mobile: 'apps/mobile',
  load: '.',
};

export const SUITE_DEFAULT_TYPE = {
  quality: 'unitaria',
  api: 'integración',
  web: 'funcional',
  mobile: 'funcional',
  load: 'rendimiento',
};

export function loadCatalog(file = DEFAULT_CATALOG) {
  try {
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { rules: [], suites: {}, defaults: {}, ...catalog };
  } catch {
    return { rules: [], suites: {}, defaults: {} };
  }
}

// Ruta del archivo respecto a la raíz del repositorio, con barras normales.
export function repoRelative(file, repoRoot = REPO_ROOT) {
  const normalized = toPosix(file).replace(/^file:\/\/\/?/, '');
  const root = toPosix(repoRoot).replace(/\/+$/, '');
  const comparable = (value) =>
    process.platform === 'win32' ? value.toLowerCase() : value;
  if (comparable(normalized).startsWith(`${comparable(root)}/`)) {
    return normalized.slice(root.length + 1);
  }
  if (path.isAbsolute(file)) {
    return toPosix(path.relative(repoRoot, file));
  }
  return normalized;
}

// Ruta relativa a la carpeta de la app de la suite (clave del catálogo).
export function appRelative(suite, repoRelFile) {
  const dir = SUITE_DIRS[suite] ?? '.';
  if (dir === '.') return repoRelFile;
  return repoRelFile.startsWith(`${dir}/`)
    ? repoRelFile.slice(dir.length + 1)
    : repoRelFile;
}

export function catalogEntry(catalog, suite, repoRelFile) {
  return catalog.suites?.[suite]?.[appRelative(suite, repoRelFile)] ?? null;
}

export function isTraced(catalog, suite, repoRelFile) {
  const entry = catalogEntry(catalog, suite, repoRelFile);
  return Boolean(entry && entry.requirements?.length);
}

// Módulo, tipo y requisitos de una prueba. Las reglas solo cambian el tipo y
// no se aplican a pruebas e2e (su tipo es una decisión explícita del archivo).
export function resolveMeta(catalog, suite, repoRelFile, fullName = '') {
  const entry = catalogEntry(catalog, suite, repoRelFile);
  const base = entry ?? catalog.defaults?.[suite] ?? {};
  const meta = {
    module: base.module ?? 'Sin clasificar',
    type: base.type ?? SUITE_DEFAULT_TYPE[suite] ?? 'funcional',
    requirements: [...(base.requirements ?? [])],
  };
  if (meta.type !== 'e2e') {
    for (const rule of catalog.rules ?? []) {
      if (rule.suite && rule.suite !== suite) continue;
      if (new RegExp(rule.match, 'i').test(fullName)) {
        meta.type = rule.type;
        break;
      }
    }
  }
  return meta;
}

export function makeTestId(suite, repoRelFile, fullName) {
  const hash = crypto
    .createHash('sha1')
    .update(`${repoRelFile}::${fullName}`)
    .digest('hex')
    .slice(0, 12);
  return `${suite}:${hash}`;
}

export function gitInfo(repoRoot = REPO_ROOT) {
  const run = (args) =>
    execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    const sha = run(['rev-parse', 'HEAD']);
    const dirty = run(['status', '--porcelain']) !== '';
    let branch = process.env.GITHUB_REF_NAME || '';
    if (!branch) {
      try {
        branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
      } catch {
        branch = 'desconocida';
      }
    }
    return { commit: dirty ? `${sha}-dirty` : sha, branch };
  } catch {
    return { commit: 'desconocido', branch: 'desconocida' };
  }
}

export function detectEnvironment() {
  return process.env.GITHUB_ACTIONS === 'true' ? 'ci' : 'local';
}

// Contexto de la corrida; el runner lo pasa a los procesos hijos por entorno.
export function contextFromEnv(env = process.env) {
  return {
    runId: env.QUALITY_RUN_ID ?? 'sin-corrida',
    suite: env.QUALITY_SUITE ?? 'quality',
    environment: env.QUALITY_ENVIRONMENT ?? detectEnvironment(),
    commit: env.QUALITY_COMMIT ?? 'desconocido',
    catalogFile: env.QUALITY_CATALOG || DEFAULT_CATALOG,
    resultsFile: env.QUALITY_RESULTS_FILE ?? '',
  };
}

// Registro con el esquema exacto de results.jsonl (el orden de claves importa
// solo por legibilidad).
export function makeRecord(ctx, catalog, input) {
  const suite = input.suite ?? ctx.suite;
  const file = input.file ?? '';
  const fullName = input.fullName ?? input.name;
  const meta = input.meta ?? resolveMeta(catalog, suite, file, fullName);
  const passed = input.status === 'aprobada';
  return {
    runId: ctx.runId,
    suite,
    testId: makeTestId(suite, file, fullName),
    name: input.name,
    fullName,
    file,
    module: meta.module,
    type: meta.type,
    requirements: meta.requirements,
    timestamp: input.timestamp ?? new Date().toISOString(),
    durationMs: Math.round((input.durationMs ?? 0) * 1000) / 1000,
    expected: input.expected ?? 'La prueba finaliza sin errores',
    actual:
      input.actual ??
      (passed ? 'Sin errores' : input.status === 'omitida' ? 'Omitida' : ''),
    status: input.status,
    errorMessage:
      passed || input.errorMessage == null
        ? null
        : truncate(input.errorMessage, 2000),
    environment: ctx.environment,
    commit: ctx.commit,
  };
}
