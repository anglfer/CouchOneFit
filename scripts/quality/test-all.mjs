// Comando central de pruebas: ejecuta las suites, registra cada resultado en
// JSONL y genera resúmenes. Uso:
//   node scripts/quality/test-all.mjs [--suites quality,api,web,mobile,load]
//     [--out test-results]
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  appendJsonl,
  gzipJsonlFiles,
  isLocalUrl,
  parseCliArgs,
  REPO_ROOT,
  round,
  toPosix,
  truncate,
} from './lib/common.mjs';
import { FlutterMachineParser } from './lib/flutter-machine.mjs';
import { runLoadSuite } from './lib/load-suite.mjs';
import { runLogged } from './lib/process.mjs';
import {
  DEFAULT_CATALOG,
  detectEnvironment,
  gitInfo,
  isTraced,
  loadCatalog,
  makeRecord,
  SUITE_DEFAULT_TYPE,
} from './lib/records.mjs';
import {
  buildReport,
  DEFAULT_CONFIG,
  loadConfig,
  writeReport,
} from './sli-report.mjs';

const ALL_SUITES = ['quality', 'api', 'web', 'mobile', 'load'];
const TIMEOUT_MS = {
  api: 20 * 60000,
  mobile: 15 * 60000,
  quality: 10 * 60000,
  web: 10 * 60000,
  load: 10 * 60000,
};
const REPORTER_URL = pathToFileURL(
  path.join(REPO_ROOT, 'scripts', 'quality', 'node-test-reporter.mjs')
).href;

function runId(now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

// Lee solo TEST_DATABASE_URL: del entorno o de apps/api/.env.
function readTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const text = fs.readFileSync(
      path.join(REPO_ROOT, 'apps', 'api', '.env'),
      'utf8'
    );
    const match = /^\s*TEST_DATABASE_URL\s*=\s*(.*)$/m.exec(text);
    if (!match) return '';
    return match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  } catch {
    return '';
  }
}

// Reglas de bloqueo de la BD local (nunca se imprime la URL: lleva clave).
function databaseBlockReason(url) {
  if (!url) {
    return 'Falta TEST_DATABASE_URL (entorno o apps/api/.env).';
  }
  if (!isLocalUrl(url)) {
    let host = 'desconocido';
    try {
      host = new URL(url).hostname;
    } catch {
      // URL inválida.
    }
    return `TEST_DATABASE_URL no es local (host: ${host}); solo se permite localhost, 127.0.0.1 o ::1.`;
  }
  return null;
}

function listTestFiles(cwd, dir, extension) {
  return fs
    .readdirSync(path.join(cwd, dir))
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => `${dir}/${name}`);
}

function commandPath(name) {
  const probe =
    process.platform === 'win32'
      ? spawnSync('where', [name], { encoding: 'utf8' })
      : spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  return probe.status === 0 ? probe.stdout.split(/\r?\n/)[0].trim() : '';
}

function flutterVersion() {
  try {
    const result = spawnSync('flutter', ['--version'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 60000,
    });
    return /^Flutter\s+(\S+)/m.exec(result.stdout ?? '')?.[1] ?? null;
  } catch {
    return null;
  }
}

function readRecords(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function counts(records) {
  const result = { total: 0, passed: 0, failed: 0, skipped: 0, blocked: 0 };
  for (const record of records) {
    result.total += 1;
    if (record.status === 'aprobada') result.passed += 1;
    else if (record.status === 'fallida') result.failed += 1;
    else if (record.status === 'omitida') result.skipped += 1;
    else if (record.status === 'bloqueada') result.blocked += 1;
  }
  // passRate = aprobadas / (aprobadas + fallidas + bloqueadas) * 100, con 2
  // decimales; las omitidas se excluyen. Sin base de cálculo vale null.
  const base = result.passed + result.failed + result.blocked;
  result.passRate = base ? round((result.passed / base) * 100, 2) : null;
  return result;
}

export function summarize(records, { suiteMeta = {}, catalog }) {
  const totals = counts(records);
  const bySuite = {};
  for (const suite of new Set(records.map((record) => record.suite))) {
    bySuite[suite] = {
      ...counts(records.filter((record) => record.suite === suite)),
      ...suiteMeta[suite],
    };
  }
  const byType = {};
  for (const type of new Set(records.map((record) => record.type))) {
    byType[type] = counts(records.filter((record) => record.type === type));
  }
  const untracedFiles = [
    ...new Set(
      records
        .filter(
          (record) =>
            record.file &&
            ['quality', 'api', 'web', 'mobile'].includes(record.suite) &&
            !isTraced(catalog, record.suite, record.file)
        )
        .map((record) => record.file)
    ),
  ].sort();
  return { totals, bySuite, byType, untracedFiles };
}

function firstLine(text) {
  return String(text ?? '').split(/\r?\n/)[0];
}

function renderSummaryMarkdown(summary) {
  const row = (label, c) =>
    `| ${label} | ${c.total} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.blocked} | ${c.passRate ?? 'n/d'} |`;
  const head = [
    '| | Total | Aprobadas | Fallidas | Omitidas | Bloqueadas | % aprobación |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  const lines = [
    `# Resultado de pruebas: ${summary.status}`,
    '',
    `Corrida \`${summary.runId}\` | commit \`${summary.commit}\` | rama \`${summary.branch}\` | entorno ${summary.environment} | duración ${round(summary.durationMs / 1000, 1)} s`,
    '',
    '## Totales',
    '',
    ...head,
    row('Total', summary.totals),
    '',
    '## Por suite',
    '',
    ...head,
    ...Object.entries(summary.bySuite).map(([name, c]) => row(name, c)),
    '',
    '## Por tipo',
    '',
    ...head,
    ...Object.entries(summary.byType).map(([name, c]) => row(name, c)),
  ];
  const problems = summary.problems ?? [];
  if (problems.length) {
    lines.push('', '## Pruebas fallidas o bloqueadas', '');
    for (const item of problems.slice(0, 50)) {
      lines.push(
        `- [${item.status}] ${item.suite}: ${item.fullName} - ${truncate(firstLine(item.errorMessage), 200)}`
      );
    }
    if (problems.length > 50) lines.push(`- ... y ${problems.length - 50} más`);
  }
  if (summary.untracedFiles.length) {
    lines.push(
      '',
      '## Archivos sin trazabilidad a requisitos',
      '',
      ...summary.untracedFiles.map((file) => `- ${file}`)
    );
  }
  lines.push('');
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const suites = (options.suites ?? ALL_SUITES.join(','))
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const unknown = suites.filter((name) => !ALL_SUITES.includes(name));
  if (unknown.length) {
    console.error(`Suites desconocidas: ${unknown.join(', ')}`);
    return 2;
  }
  const outDir = path.resolve(
    options.out ?? path.join(REPO_ROOT, 'test-results')
  );
  const startedAt = new Date();
  const id = runId(startedAt);
  const runDir = path.join(outDir, 'runs', id);
  const suitesDir = path.join(runDir, 'suites');
  const resultsFile = path.join(runDir, 'results.jsonl');
  fs.mkdirSync(suitesDir, { recursive: true });
  fs.writeFileSync(resultsFile, '');

  const git = gitInfo(REPO_ROOT);
  const environment = detectEnvironment();
  const catalog = loadCatalog(DEFAULT_CATALOG);
  const sloConfig = loadConfig(DEFAULT_CONFIG);
  const baseCtx = {
    runId: id,
    environment,
    commit: git.commit,
    catalogFile: DEFAULT_CATALOG,
  };
  const childEnv = (suite) => ({
    ...process.env,
    QUALITY_RUN_ID: id,
    QUALITY_SUITE: suite,
    QUALITY_ENVIRONMENT: environment,
    QUALITY_COMMIT: git.commit,
    QUALITY_CATALOG: DEFAULT_CATALOG,
    QUALITY_RESULTS_FILE: resultsFile,
  });

  // Registro sintético del runner (bloqueos, fallos de proceso y carga).
  const writeRecord = (suite, input) => {
    const file = input.file ?? '';
    const record = makeRecord({ ...baseCtx, suite }, catalog, {
      suite,
      file,
      meta: input.meta ?? {
        module: 'Ejecución de la suite',
        type: SUITE_DEFAULT_TYPE[suite],
        requirements: [],
      },
      ...input,
    });
    appendJsonl(resultsFile, record);
    return record;
  };
  const block = (suite, reason) => {
    console.error(`[${suite}] suite bloqueada: ${reason}`);
    writeRecord(suite, {
      name: `${suite}: suite bloqueada`,
      status: 'bloqueada',
      expected: 'La suite se ejecuta',
      actual: 'No se ejecutó',
      errorMessage: reason,
    });
  };

  const suiteMeta = {};
  const host = {
    os: `${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`,
    node: process.version,
  };
  const databaseUrl = readTestDatabaseUrl();

  const finishProcess = (suite, result, expectedLabel = 'exit 0') => {
    const records = readRecords(resultsFile).filter((r) => r.suite === suite);
    const failures = records.filter((r) => r.status === 'fallida').length;
    if (result.timedOut) {
      writeRecord(suite, {
        name: `${suite}: tiempo agotado`,
        status: 'fallida',
        durationMs: result.durationMs,
        expected: `La suite termina en ≤ ${TIMEOUT_MS[suite] / 60000} min`,
        actual: 'tiempo agotado',
        errorMessage: `tiempo agotado tras ${TIMEOUT_MS[suite] / 60000} min; proceso detenido`,
      });
    } else if (result.code !== 0 && failures === 0) {
      const tail = (
        result.stderrTail.length ? result.stderrTail : result.outputTail
      ).join('\n');
      writeRecord(suite, {
        name: `${suite}: el proceso terminó con código ${result.code}`,
        status: 'fallida',
        durationMs: result.durationMs,
        expected: expectedLabel,
        actual: `código ${result.code}`,
        errorMessage: result.spawnError ?? (tail || 'Sin salida de error'),
      });
    } else if (result.code === 0 && records.length === 0) {
      writeRecord(suite, {
        name: `${suite}: la suite no produjo resultados`,
        status: 'fallida',
        durationMs: result.durationMs,
        expected: 'Al menos una prueba registrada',
        actual: 'Cero pruebas registradas',
        errorMessage: 'El proceso terminó sin registrar pruebas.',
      });
    }
    suiteMeta[suite] = { durationMs: result.durationMs, exitCode: result.code };
  };

  const reporterFlags = [
    '--test-reporter=spec',
    '--test-reporter-destination=stdout',
    `--test-reporter=${REPORTER_URL}`,
    '--test-reporter-destination=stdout',
  ];

  const runNodeSuite = async (suite, cwd, prefixArgs, files, extraEnv = {}) => {
    const result = await runLogged({
      command: process.execPath,
      args: [...prefixArgs, ...reporterFlags, ...files],
      cwd,
      env: { ...childEnv(suite), ...extraEnv },
      logFile: path.join(suitesDir, `${suite}.log`),
      timeoutMs: TIMEOUT_MS[suite],
    });
    finishProcess(suite, result);
  };

  for (const suite of suites) {
    console.log(`\n=== Suite ${suite} ===`);
    try {
      if (suite === 'quality') {
        await runNodeSuite(
          'quality',
          REPO_ROOT,
          ['--test'],
          listTestFiles(REPO_ROOT, 'scripts/quality/tests', '.test.mjs')
        );
      } else if (suite === 'api') {
        const apiDir = path.join(REPO_ROOT, 'apps', 'api');
        const tsxCli = path.join(
          apiDir,
          'node_modules',
          'tsx',
          'dist',
          'cli.mjs'
        );
        const reason =
          databaseBlockReason(databaseUrl) ??
          (fs.existsSync(tsxCli)
            ? null
            : 'Faltan dependencias de apps/api (ejecuta npm --prefix apps/api ci).');
        if (reason) block('api', reason);
        else {
          await runNodeSuite(
            'api',
            apiDir,
            [tsxCli, '--test', '--test-concurrency=1'],
            listTestFiles(apiDir, 'tests', '.test.ts'),
            {
              TEST_DATABASE_URL: databaseUrl,
              // Evita escrituras accidentales a la BD de .env.
              DATABASE_URL: databaseUrl,
              LOG_DIR: path.join(runDir, 'api-logs', 'api-suite'),
              LOG_LEVEL: 'info',
            }
          );
        }
      } else if (suite === 'web') {
        const webDir = path.join(REPO_ROOT, 'apps', 'web');
        if (!fs.existsSync(path.join(webDir, 'node_modules'))) {
          block(
            'web',
            'Faltan dependencias de apps/web (npm --prefix apps/web ci).'
          );
        } else {
          await runNodeSuite(
            'web',
            webDir,
            ['--test'],
            listTestFiles(webDir, 'tests', '.test.mjs')
          );
        }
      } else if (suite === 'mobile') {
        const mobileDir = path.join(REPO_ROOT, 'apps', 'mobile');
        let reason = null;
        if (!commandPath('flutter'))
          reason = 'Flutter no está instalado o no está en el PATH.';
        else if (!fs.existsSync(path.join(mobileDir, '.env.json'))) {
          reason = 'Falta apps/mobile/.env.json (créalo desde .env.example).';
        }
        if (reason) block('mobile', reason);
        else {
          host.flutter = flutterVersion();
          const ctx = { ...baseCtx, suite: 'mobile' };
          const parser = new FlutterMachineParser({
            ctx,
            catalog,
            repoRoot: REPO_ROOT,
            onRecord: (record) => {
              appendJsonl(resultsFile, record);
              console.log(`[mobile] ${record.status}: ${record.fullName}`);
            },
          });
          const result = await runLogged({
            command: 'flutter',
            args: ['test', '--machine'],
            cwd: mobileDir,
            env: childEnv('mobile'),
            shell: process.platform === 'win32',
            logFile: path.join(suitesDir, 'mobile.log'),
            timeoutMs: TIMEOUT_MS.mobile,
            onStdoutLine: (line) => parser.feedLine(line),
            echoStdout: false,
          });
          finishProcess('mobile', result);
        }
      } else if (suite === 'load') {
        const reason =
          databaseBlockReason(databaseUrl) ??
          (fs.existsSync(
            path.join(REPO_ROOT, 'apps', 'api', 'node_modules', 'tsx')
          )
            ? null
            : 'Faltan dependencias de apps/api (ejecuta npm --prefix apps/api ci).');
        if (reason) block('load', reason);
        else {
          const started = Date.now();
          await runLoadSuite({
            runDir,
            repoRoot: REPO_ROOT,
            databaseUrl,
            sloConfig,
            durationS: Number(process.env.QUALITY_LOAD_DURATION_S) || 20,
            logFile: path.join(suitesDir, 'load.log'),
            record: (input) =>
              writeRecord('load', {
                file: 'scripts/quality/load-test.mjs',
                meta: {
                  module: 'Carga y recuperación',
                  type: 'rendimiento',
                  requirements: [],
                },
                ...input,
              }),
          });
          const failures = readRecords(resultsFile).filter(
            (r) => r.suite === 'load' && r.status === 'fallida'
          ).length;
          suiteMeta.load = {
            durationMs: Date.now() - started,
            exitCode: failures ? 1 : 0,
          };
        }
      }
    } catch (error) {
      writeRecord(suite, {
        name: `${suite}: error del runner`,
        status: 'fallida',
        expected: 'El runner ejecuta la suite',
        actual: 'Error inesperado',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Informe SLI solo con la evidencia de la suite de carga (los logs de la
  // suite api provocan errores a propósito y no son una medición de servicio).
  if (
    suites.includes('load') &&
    fs.existsSync(path.join(runDir, 'load.jsonl'))
  ) {
    try {
      writeReport(
        buildReport({
          config: sloConfig,
          logs: [path.join(runDir, 'api-logs', 'load')],
          synthetic: [path.join(runDir, 'synthetic')],
          load: [path.join(runDir, 'load.jsonl')],
        }),
        runDir
      );
    } catch (error) {
      console.error(`No se pudo generar el informe SLI: ${error.message}`);
      writeRecord('load', {
        name: 'Generación del informe SLI/SLO',
        file: 'scripts/quality/sli-report.mjs',
        status: 'fallida',
        expected: 'El informe SLI/SLO se genera con la evidencia de carga',
        actual: error.message,
        errorMessage: error.message,
        meta: {
          module: 'Medición de SLI/SLO',
          type: 'rendimiento',
          requirements: ['RNF09', 'RNF10'],
        },
      });
    }
  }
  // Los logs de carga pesan decenas de MB: se guardan comprimidos (zlib nativo).
  gzipJsonlFiles(path.join(runDir, 'api-logs'));

  const finishedAt = new Date();
  const records = readRecords(resultsFile);
  const { totals, bySuite, byType, untracedFiles } = summarize(records, {
    suiteMeta,
    catalog,
  });
  const ok = totals.failed === 0 && totals.blocked === 0 && totals.total > 0;
  const summary = {
    runId: id,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    commit: git.commit,
    branch: git.branch,
    environment,
    host,
    totals,
    bySuite,
    byType,
    untracedFiles,
    status: ok ? 'aprobada' : 'fallida',
  };
  fs.writeFileSync(
    path.join(runDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(runDir, 'summary.md'),
    renderSummaryMarkdown({
      ...summary,
      problems: records.filter(
        (r) => r.status === 'fallida' || r.status === 'bloqueada'
      ),
    })
  );
  appendJsonl(path.join(outDir, 'history.jsonl'), {
    runId: id,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    commit: git.commit,
    branch: git.branch,
    environment,
    suites,
    totals,
    status: summary.status,
  });
  console.log(
    `\nResultado: ${summary.status} | total ${totals.total}, aprobadas ${totals.passed}, fallidas ${totals.failed}, omitidas ${totals.skipped}, bloqueadas ${totals.blocked}`
  );
  console.log(`Carpeta de la corrida: ${toPosix(runDir)}`);
  return ok ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error);
      process.exitCode = 2;
    }
  );
}
