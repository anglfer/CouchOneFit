// Suite `load`: levanta la API local, mide carga de lectura y simula una
// caída y recuperación del proceso. Solo contra la BD local de pruebas.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { round } from './common.mjs';
import { findFreePort, killTree } from './process.mjs';
import {
  buildC02Steps,
  createWebSession,
  runLoad,
  runPaced,
} from '../load-test.mjs';
import { runProbes } from '../synthetic-check.mjs';

const SOURCE_FILE = 'scripts/quality/load-test.mjs';
const READY_TIMEOUT_MS = 65000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer({ apiDir, tsxCli, env, logFile }) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  const child = spawn(process.execPath, [tsxCli, 'src/server.ts'], {
    cwd: apiDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // Own process group on Linux/macOS so killTree also stops tsx's grandchild.
    detached: process.platform !== 'win32',
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.once('close', () => log.end());
  return child;
}

async function waitReady(base, timeoutMs, child) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (child.exitCode !== null) return null;
    try {
      const response = await fetch(`${base}/api/health/ready`, {
        signal: AbortSignal.timeout(2000),
      });
      await response.arrayBuffer();
      if (response.status === 200) return (performance.now() - started) / 1000;
    } catch {
      // El servidor aún no escucha.
    }
    await sleep(250);
  }
  return null;
}

const C02_ORIGIN = 'http://localhost:5000';
const C02_CLIENTS = 16;

// Crea (solo inserciones) un profesional Élite y expedientes sintéticos en la
// BD local de pruebas. La contraseña viaja por entorno y nunca se imprime.
function prepareC02Fixture({ apiDir, tsxCli, databaseUrl }) {
  const suffix = crypto.randomBytes(5).toString('hex');
  const username = `qa.load.${suffix}`;
  const password = crypto.randomBytes(24).toString('base64url');
  const result = spawnSync(
    process.execPath,
    [tsxCli, 'scripts/prepare-load-fixture.ts'],
    {
      cwd: apiDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      env: {
        ...process.env,
        TEST_DATABASE_URL: databaseUrl,
        DATABASE_URL: databaseUrl,
        LOAD_FIXTURE_USERNAME: username,
        LOAD_FIXTURE_PASSWORD: password,
        LOAD_FIXTURE_CLIENTS: String(C02_CLIENTS),
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `No se pudo preparar la cuenta sintética de carga: ${(result.stderr || '').trim().split(/\r?\n/)[0] || `código ${result.status}`}`
    );
  }
  const { clientIds } = JSON.parse(result.stdout.trim().split(/\r?\n/).pop());
  return { username, password, clientIds };
}

function shortCommit(repoRoot) {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : 'local';
}

// Indicador C-02 del SLA v3.0: p95 con 15 concurrentes y 5 rps sostenidos,
// ≥ 500 muestras por tipo. Con menos muestras se omite (nunca se aprueba).
async function runC02({
  base,
  runDir,
  repoRoot,
  apiDir,
  tsxCli,
  databaseUrl,
  thresholds,
  c02DurationS,
  record,
}) {
  const fixture = prepareC02Fixture({ apiDir, tsxCli, databaseUrl });
  const session = await createWebSession({
    base,
    origin: C02_ORIGIN,
    username: fixture.username,
    password: fixture.password,
  });
  const result = await runPaced({
    steps: buildC02Steps({ session, clientIds: fixture.clientIds }),
    rps: thresholds.c02Rps,
    concurrency: thresholds.concurrency,
    durationS: c02DurationS,
  });
  const summary = {
    version: shortCommit(repoRoot),
    readP95Ms: result.read.p95,
    writeP95Ms: result.write.p95,
    readSamples: result.read.samples,
    writeSamples: result.write.samples,
    concurrency: result.concurrency,
    rps: result.rps,
    durationS: c02DurationS,
  };
  fs.writeFileSync(
    path.join(runDir, 'c02-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  fs.appendFileSync(
    path.join(runDir, 'load.jsonl'),
    `${JSON.stringify(result)}\n`
  );
  const minSamples = thresholds.c02MinSamples;
  const kinds = [
    ['lectura', 'read', thresholds.readP95MaxMs],
    ['escritura', 'write', thresholds.writeP95MaxMs],
  ];
  for (const [label, key, maxMs] of kinds) {
    const stats = result[key];
    const name = `C-02 ${label} (p95 ≤ ${maxMs} ms)`;
    const meta = {
      module: 'Latencia bajo carga de referencia (SLA C-02)',
      type: 'rendimiento',
      requirements: ['RNF09'],
    };
    const expected = `p95 ≤ ${maxMs} ms, errores ≤ ${thresholds.errorRateMaxPct} % con ${thresholds.concurrency} concurrentes y ${thresholds.c02Rps} rps, ≥ ${minSamples} muestras`;
    const actual = `p95 ${stats.p95} ms, errores ${stats.errorRate} %, n=${stats.samples}, ${result.achievedRps} rps, ${result.delayed} peticiones retrasadas por el tope de concurrencia`;
    if (stats.samples < minSamples) {
      record({
        name,
        status: 'omitida',
        durationMs: result.durationS * 1000,
        expected,
        actual,
        errorMessage: `muestra insuficiente para C-02: n=${stats.samples} < ${minSamples}; usa QUALITY_LOAD_C02_DURATION_S=300`,
        meta,
      });
      continue;
    }
    const problems = [];
    if (stats.p95 > maxMs) problems.push(`p95 ${stats.p95} ms > ${maxMs} ms`);
    if (stats.errorRate > thresholds.errorRateMaxPct) {
      problems.push(
        `errores ${stats.errorRate} % > ${thresholds.errorRateMaxPct} %`
      );
    }
    record({
      name,
      status: problems.length ? 'fallida' : 'aprobada',
      durationMs: result.durationS * 1000,
      expected,
      actual,
      errorMessage: problems.join('; '),
      meta,
    });
  }
  return { summary, result };
}

export async function runLoadSuite({
  runDir,
  repoRoot,
  databaseUrl,
  sloConfig,
  durationS,
  c02DurationS = Number(process.env.QUALITY_LOAD_C02_DURATION_S) || 20,
  record,
  logFile,
}) {
  const apiDir = path.join(repoRoot, 'apps', 'api');
  const tsxCli = path.join(apiDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const thresholds = sloConfig.load;
  const port = await findFreePort();
  const base = `http://127.0.0.1:${port}`;
  const loadFile = path.join(runDir, 'load.jsonl');
  const syntheticDir = path.join(runDir, 'synthetic');
  const env = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: databaseUrl,
    // Secreto efímero: no se escribe en disco ni en logs.
    AUTH_JWT_SECRET: crypto.randomBytes(48).toString('base64'),
    NODE_ENV: 'test',
    LOG_DIR: path.join(runDir, 'api-logs', 'load'),
    LOG_LEVEL: 'info',
    // Origen permitido para CSRF: el mismo que usa la sesión de C-02.
    CORS_ORIGIN: C02_ORIGIN,
  };
  const serverOptions = { apiDir, tsxCli, env, logFile };
  let server = null;
  let probeAbort = new AbortController();
  let probeTask = null;
  const probeOptions = {
    targets: [`${base}/api/health/ready`],
    intervalS: 1,
    count: Infinity,
    timeoutMs: 5000,
    outDir: syntheticDir,
  };
  const failed = (name, message, expected) =>
    record({
      name,
      status: 'fallida',
      expected,
      actual: message,
      errorMessage: message,
    });

  try {
    server = startServer(serverOptions);
    const bootS = await waitReady(base, READY_TIMEOUT_MS, server);
    if (bootS === null) {
      failed(
        'Arranque de la API para la prueba de carga',
        'La API no respondió 200 en /api/health/ready dentro de 65 s.',
        'La API queda lista en ≤ 65 s'
      );
      return;
    }

    probeTask = runProbes({ ...probeOptions, signal: probeAbort.signal });

    const results = await runLoad({
      base,
      concurrency: thresholds.concurrency,
      durationS,
      outFile: loadFile,
    });
    for (const result of results) {
      const problems = [];
      if (result.latencyMs.p95 > thresholds.p95MaxMs) {
        problems.push(
          `p95 ${result.latencyMs.p95} ms > ${thresholds.p95MaxMs} ms`
        );
      }
      if (result.errorRate > thresholds.errorRateMaxPct) {
        problems.push(
          `errores ${result.errorRate} % > ${thresholds.errorRateMaxPct} %`
        );
      }
      if (result.throughputRps < thresholds.throughputMinRps) {
        problems.push(
          `throughput ${result.throughputRps} rps < ${thresholds.throughputMinRps} rps`
        );
      }
      record({
        name: `Carga ${result.scenario}: GET ${result.path}`,
        status: problems.length ? 'fallida' : 'aprobada',
        durationMs: result.durationS * 1000,
        expected: `p95 ≤ ${thresholds.p95MaxMs} ms, errores ≤ ${thresholds.errorRateMaxPct} %, throughput ≥ ${thresholds.throughputMinRps} rps (${thresholds.concurrency} concurrentes)`,
        actual: `p95 ${result.latencyMs.p95} ms, errores ${result.errorRate} %, throughput ${result.throughputRps} rps, ${result.requests} peticiones`,
        errorMessage: problems.join('; '),
        meta: {
          module: 'Rendimiento de lectura',
          type: 'rendimiento',
          requirements: ['RNF09', 'TT-021-1'],
        },
      });
    }

    try {
      const { summary } = await runC02({
        base,
        runDir,
        repoRoot,
        apiDir,
        tsxCli,
        databaseUrl,
        thresholds,
        c02DurationS,
        record,
      });
      console.log(
        `C-02: lectura p95 ${summary.readP95Ms} ms (n=${summary.readSamples}), escritura p95 ${summary.writeP95Ms} ms (n=${summary.writeSamples})`
      );
    } catch (error) {
      failed(
        'C-02: preparación o ejecución de la carga mixta',
        error instanceof Error ? error.message : String(error),
        'La carga mixta C-02 se ejecuta sin errores de preparación'
      );
    }

    // Simulacro de recuperación: caída del proceso y nuevo arranque. Sus
    // sondeos van marcados para medir recuperación sin contar como caída real.
    probeAbort.abort();
    await probeTask;
    probeAbort = new AbortController();
    probeTask = runProbes({
      ...probeOptions,
      signal: probeAbort.signal,
      phase: 'recovery-drill',
    });
    const killedAt = performance.now();
    killTree(server);
    if (server.exitCode === null) {
      // Bounded: a surviving grandchild must fail the drill, not hang CI 40 min.
      await Promise.race([
        new Promise((resolve) => server.once('close', resolve)),
        sleep(15_000),
      ]);
    }
    await sleep(3000);
    let stillUp = false;
    try {
      const response = await fetch(`${base}/api/health/ready`, {
        signal: AbortSignal.timeout(2000),
      });
      await response.arrayBuffer();
      stillUp = response.status === 200;
    } catch {
      stillUp = false;
    }
    server = startServer(serverOptions);
    const recovered = await waitReady(base, READY_TIMEOUT_MS, server);
    const recoveryS = (performance.now() - killedAt) / 1000;
    // Deja que el sondeo periódico registre el restablecimiento.
    await sleep(2000);
    const recoveryMeta = {
      module: 'Disponibilidad y recuperación',
      type: 'recuperación',
      requirements: ['RNF10', 'RNF15'],
    };
    const expected = `recupera en ≤ ${thresholds.recoveryMaxS} s`;
    const name = 'Recuperación tras reinicio del proceso API';
    if (stillUp) {
      record({
        name,
        status: 'fallida',
        expected,
        actual: 'El servidor siguió respondiendo tras detener el proceso.',
        errorMessage: 'El simulacro no pudo provocar la caída del servidor.',
        meta: recoveryMeta,
      });
    } else if (recovered === null || recoveryS > thresholds.recoveryMaxS) {
      record({
        name,
        status: 'fallida',
        durationMs: recoveryS * 1000,
        expected,
        actual:
          recovered === null
            ? 'No recuperó dentro del tiempo de espera.'
            : `${round(recoveryS, 1)} s`,
        errorMessage: `Recuperación superior a ${thresholds.recoveryMaxS} s o ausente.`,
        meta: recoveryMeta,
      });
    } else {
      record({
        name,
        status: 'aprobada',
        durationMs: recoveryS * 1000,
        expected,
        actual: `${round(recoveryS, 1)} s`,
        meta: recoveryMeta,
      });
    }
  } catch (error) {
    failed(
      'Suite de carga: error inesperado',
      error instanceof Error ? error.message : String(error),
      'La suite de carga termina sin errores'
    );
  } finally {
    probeAbort.abort();
    if (probeTask) await probeTask.catch(() => {});
    if (server) killTree(server);
  }
}
