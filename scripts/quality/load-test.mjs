// Prueba de carga de solo lectura (GET) con trabajadores de lazo cerrado.
// Uso: node scripts/quality/load-test.mjs --base http://127.0.0.1:3000
//   [--concurrency 15] [--duration 30] [--scenarios health,ready,plans]
//   [--out <archivo.jsonl>] [--allow-remote]
// Nunca ejecuta escrituras ni login. No debe apuntar a producción.
import { pathToFileURL } from 'node:url';
import {
  appendJsonl,
  extent,
  isLocalHost,
  mean,
  parseCliArgs,
  percentile,
  round,
} from './lib/common.mjs';

export const SCENARIOS = {
  health: '/api/health',
  ready: '/api/health/ready',
  plans: '/api/plans',
};
export const CLIENT_TIMEOUT_MS = 20000;

export function assertAllowedBase(base, { allowRemote = false } = {}) {
  const url = new URL(base);
  if (!isLocalHost(url.hostname) && !allowRemote) {
    throw new Error(
      `Se rechaza ${url.hostname}: la carga solo se ejecuta contra localhost. Usa --allow-remote bajo tu responsabilidad.`
    );
  }
  return url;
}

export async function runScenario({
  base,
  scenario,
  concurrency = 15,
  durationS = 30,
  timeoutMs = CLIENT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  const route = SCENARIOS[scenario];
  if (!route) throw new Error(`Escenario desconocido: ${scenario}`);
  const url = new URL(route, base).href;
  const latencies = [];
  let errors = 0;
  const started = performance.now();
  const deadline = started + durationS * 1000;

  const worker = async () => {
    while (performance.now() < deadline) {
      const t0 = performance.now();
      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs),
        });
        await response.arrayBuffer();
        if (!response.ok) errors += 1;
      } catch {
        errors += 1;
      }
      latencies.push(performance.now() - t0);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  const elapsedS = (performance.now() - started) / 1000;
  const requests = latencies.length;
  return {
    ts: new Date().toISOString(),
    event: 'load.scenario',
    scenario,
    method: 'GET',
    path: route,
    concurrency,
    durationS: round(elapsedS, 2),
    requests,
    errors,
    errorRate: round(requests ? (errors / requests) * 100 : 0, 3),
    throughputRps: round(elapsedS > 0 ? requests / elapsedS : 0, 2),
    latencyMs: {
      mean: round(mean(latencies), 2),
      p50: round(percentile(latencies, 50), 2),
      p95: round(percentile(latencies, 95), 2),
      p99: round(percentile(latencies, 99), 2),
      max: round(extent(latencies).max, 2),
    },
  };
}

export async function runLoad({
  base,
  scenarios = Object.keys(SCENARIOS),
  outFile = null,
  allowRemote = false,
  onResult = null,
  ...options
}) {
  assertAllowedBase(base, { allowRemote });
  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario({ base, scenario, ...options });
    if (outFile) appendJsonl(outFile, result);
    onResult?.(result);
    results.push(result);
  }
  return results;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2), {
    flags: ['allow-remote'],
  });
  if (!options.base) throw new Error('Indica --base <url>.');
  if (options['allow-remote']) {
    console.warn(
      'ADVERTENCIA: la carga nunca debe dirigirse a producción ni a servicios compartidos.'
    );
  }
  const results = await runLoad({
    base: options.base,
    concurrency: Number(options.concurrency ?? 15),
    durationS: Number(options.duration ?? 30),
    scenarios: (options.scenarios ?? 'health,ready,plans').split(','),
    outFile: options.out ?? null,
    allowRemote: Boolean(options['allow-remote']),
    onResult: (r) =>
      console.log(
        `${r.scenario}: ${r.requests} peticiones, ${r.errors} errores, ${r.throughputRps} rps, p95 ${r.latencyMs.p95} ms`
      ),
  });
  if (!results.length) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
