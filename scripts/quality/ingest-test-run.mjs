// Ingesta opcional de una corrida de `test-all.mjs` hacia `/api/observability/ingest`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT } from './lib/common.mjs';

const MAX_CHECKS_PER_BATCH = 500;
const TEST_RESULTS = {
  aprobada: ['passed', 'La prueba terminó correctamente.'],
  fallida: ['failed', 'La prueba falló. Consulta la evidencia de CI.'],
  omitida: ['skipped', 'La prueba se omitió.'],
  bloqueada: ['blocked', 'La prueba no pudo comenzar. Consulta la evidencia de CI.'],
};

export function buildCiBatches(summary, records, triggerSource) {
  const correlationId = `ci-${summary.runId}`;
  const environment = summary.environment === 'ci' ? 'ci' : 'local';
  const checks = records.map((record, index) => {
    const [status, actualResult] = TEST_RESULTS[record.status] ??
      ['not_executed', 'La prueba no se ejecutó.'];
    return {
      externalEventId: `${correlationId}-${index}-${String(record.testId).slice(0, 64)}`,
      correlationId,
      checkKey: `${record.suite}:${record.testId}`.slice(0, 100),
      checkName: String(record.fullName ?? record.name ?? 'Prueba automatizada').slice(0, 150),
      checkKind: record.suite === 'load' ? 'load_scenario' : 'automated_test',
      service: record.suite === 'web' ? 'web' : record.suite === 'mobile' ? 'mobile' : 'api',
      module: String(record.module ?? record.suite).slice(0, 60),
      environment,
      target: typeof record.file === 'string' && /^[\w/.-]{1,300}$/.test(record.file) ? record.file : null,
      phase: 'regular',
      executedAt: record.timestamp ?? summary.finishedAt,
      expectedResult: 'La prueba finaliza sin errores.',
      actualResult,
      status,
      durationMs: typeof record.durationMs === 'number' ? record.durationMs : null,
      httpStatus: null,
      errorCode: status === 'failed' ? 'TEST_FAILED' : null,
      errorMessage: null,
      assertions: [],
    };
  });
  const batchCount = Math.ceil(checks.length / MAX_CHECKS_PER_BATCH);
  return Array.from({ length: batchCount }, (_, batchIndex) => {
    const start = batchIndex * MAX_CHECKS_PER_BATCH;
    return {
      run: {
        externalRunId: `${correlationId}-${batchIndex + 1}`,
        category: 'ci_suite',
        environment,
        triggerSource,
        startedAt: summary.startedAt,
        finishedAt: summary.finishedAt,
        durationMs: summary.durationMs,
        commitSha: summary.commit ?? null,
        notes: `Corrida ${summary.runId}, parte ${batchIndex + 1}/${batchCount} (${checks.length} pruebas en total).`,
      },
      checks: checks.slice(start, start + MAX_CHECKS_PER_BATCH),
    };
  });
}

async function main() {
  const ingestUrl = process.env.OBSERVABILITY_INGEST_URL?.trim();
  const ingestToken = process.env.OBSERVABILITY_INGEST_TOKEN?.trim();
  if (!ingestUrl || !ingestToken) {
    console.log('Ingesta CI omitida: OBSERVABILITY_INGEST_URL/TOKEN no configurados.');
    return;
  }

  const url = new URL(ingestUrl);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) {
    throw new Error('La ingesta requiere una URL HTTPS sin credenciales.');
  }
  const runsDir = path.join(REPO_ROOT, 'test-results', 'runs');
  const latest = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).sort().at(-1) : undefined;
  const runDir = process.argv[2] ? path.resolve(process.argv[2]) : latest && path.join(runsDir, latest);
  if (!runDir) throw new Error('Sin corridas para sincronizar.');
  const summaryFile = path.join(runDir, 'summary.json');
  const resultsFile = path.join(runDir, 'results.jsonl');

  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  const records = fs
    .readFileSync(resultsFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const triggerSource = summary.environment === 'ci' ? 'github_actions' : 'local_runner';
  for (const payload of buildCiBatches(summary, records, triggerSource)) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Observability-Token': ingestToken,
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`Ingesta CI ${payload.run.externalRunId}: HTTP ${response.status}`);
    if (!response.ok) throw new Error('El servicio rechazó la ingesta.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(() => {
    console.error('Ingesta CI incompleta. Conserva la evidencia para reintentar.');
    process.exitCode = 1;
  });
}
