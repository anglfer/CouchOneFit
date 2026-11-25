// Suite `load`: levanta la API local, mide carga de lectura y simula una
// caída y recuperación del proceso. Solo contra la BD local de pruebas.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { round } from './common.mjs';
import { findFreePort, killTree } from './process.mjs';
import { runLoad } from '../load-test.mjs';
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

export async function runLoadSuite({
  runDir,
  repoRoot,
  databaseUrl,
  sloConfig,
  durationS,
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
      await new Promise((resolve) => server.once('close', resolve));
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
