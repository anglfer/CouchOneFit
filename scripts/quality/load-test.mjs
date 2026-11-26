// Prueba de carga. Escenarios de solo lectura (GET) con trabajadores de lazo
// cerrado y, para el indicador C-02 del SLA, un modo de lazo abierto con tasa
// de llegada fija (`runPaced`) que mezcla lecturas y escrituras.
// Uso: node scripts/quality/load-test.mjs --base http://127.0.0.1:3000
//   [--concurrency 15] [--duration 30] [--scenarios health,ready,plans]
//   [--out <archivo.jsonl>] [--allow-remote]
// La CLI solo ejecuta los escenarios GET; las escrituras de C-02 las orquesta
// lib/load-suite.mjs con datos sintéticos propios. No debe apuntar a producción.
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

// Reparto determinista por pesos (round-robin suave): con pesos 4/4 alterna
// y garantiza la proporción exacta sin depender del azar.
export function weightedPicker(steps) {
  const credit = steps.map(() => 0);
  const total = steps.reduce((sum, step) => sum + step.weight, 0);
  return () => {
    let best = 0;
    for (let i = 0; i < steps.length; i += 1) {
      credit[i] += steps[i].weight;
      if (credit[i] > credit[best]) best = i;
    }
    credit[best] -= total;
    return steps[best];
  };
}

export function typeStats(latencies, errors) {
  const samples = latencies.length;
  return {
    samples,
    errors,
    errorRate: round(samples ? (errors / samples) * 100 : 0, 3),
    p50: round(percentile(latencies, 50), 2),
    p95: round(percentile(latencies, 95), 2),
    p99: round(percentile(latencies, 99), 2),
  };
}

// Lazo abierto: llegadas a `rps` fija durante `durationS`; como máximo
// `concurrency` peticiones en vuelo. Si una llegada excede el tope espera un
// hueco (se cuenta en `delayed`); la latencia se mide desde el envío real.
// Cada paso: { name, type: 'read' | 'write', weight, run: async () => ({ ok }) }.
export async function runPaced({
  steps,
  rps = 5,
  concurrency = 15,
  durationS = 30,
}) {
  if (!steps?.length) throw new Error('Indica al menos un paso.');
  if (!(rps > 0) || !(concurrency > 0)) {
    throw new Error('rps y concurrency deben ser mayores que 0.');
  }
  const pick = weightedPicker(steps);
  const series = {
    read: { latencies: [], errors: 0 },
    write: { latencies: [], errors: 0 },
  };
  const bySteps = new Map(steps.map((step) => [step.name, 0]));
  let inFlight = 0;
  let maxInFlight = 0;
  let delayed = 0;
  let arrivals = 0;
  const waiters = [];
  const tasks = [];
  const started = performance.now();
  const deadline = started + durationS * 1000;
  const intervalMs = 1000 / rps;

  const execute = async (step) => {
    const t0 = performance.now();
    let failed = false;
    try {
      const outcome = await step.run();
      failed = !outcome?.ok;
    } catch {
      failed = true;
    }
    const bucket = series[step.type];
    bucket.latencies.push(performance.now() - t0);
    if (failed) bucket.errors += 1;
    bySteps.set(step.name, bySteps.get(step.name) + 1);
    inFlight -= 1;
    waiters.shift()?.();
  };

  for (let k = 0; ; k += 1) {
    const scheduled = started + k * intervalMs;
    if (scheduled >= deadline) break;
    const wait = scheduled - performance.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    arrivals += 1;
    if (inFlight >= concurrency) {
      delayed += 1;
      await new Promise((resolve) => waiters.push(resolve));
    }
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    tasks.push(execute(pick()));
  }
  await Promise.all(tasks);

  const elapsedS = (performance.now() - started) / 1000;
  return {
    ts: new Date().toISOString(),
    event: 'load.paced',
    rps,
    concurrency,
    durationS: round(elapsedS, 2),
    arrivals,
    delayed,
    maxInFlight,
    achievedRps: round(elapsedS > 0 ? arrivals / elapsedS : 0, 2),
    read: typeStats(series.read.latencies, series.read.errors),
    write: typeStats(series.write.latencies, series.write.errors),
    steps: Object.fromEntries(bySteps),
  };
}

// Cookies de sesión y CSRF como la Web: GET /api/auth/csrf y POST /api/auth/login.
export async function createWebSession({
  base,
  origin,
  username,
  password,
  fetchImpl = fetch,
  timeoutMs = CLIENT_TIMEOUT_MS,
}) {
  const jar = new Map();
  const absorb = (response) => {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  };
  const cookie = () =>
    [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const csrfResponse = await fetchImpl(new URL('/api/auth/csrf', base), {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const { csrfToken } = await csrfResponse.json();
  absorb(csrfResponse);
  const login = await fetchImpl(new URL('/api/auth/login', base), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-CSRF-Token': csrfToken,
      Cookie: cookie(),
    },
    body: JSON.stringify({ identifier: username, password }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  await login.arrayBuffer();
  if (!login.ok) {
    throw new Error(`Login de la cuenta sintética de carga: HTTP ${login.status}`);
  }
  absorb(login);
  return {
    request(path, { method = 'GET', body } = {}) {
      const headers = { Cookie: cookie() };
      if (method !== 'GET') {
        headers.Origin = origin;
        headers['X-CSRF-Token'] = csrfToken;
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetchImpl(new URL(path, base), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    },
  };
}

// Mezcla C-02: 50 % lecturas (planes, cartera, detalle, expediente) y 50 %
// escrituras (PATCH de expediente alternando el objetivo). Cada escritura toma
// un expediente libre: la versión optimista nunca choca entre peticiones.
export function buildC02Steps({ session, clientIds }) {
  const pool = clientIds.map((id) => ({ id, version: 1, flip: false }));
  const waiters = [];
  const acquire = async () =>
    pool.shift() ?? (await new Promise((resolve) => waiters.push(resolve)));
  const release = (entry) => {
    const waiter = waiters.shift();
    if (waiter) waiter(entry);
    else pool.push(entry);
  };
  const readId = clientIds[0];
  const read = (name, path) => ({
    name,
    type: 'read',
    weight: 1,
    run: async () => {
      const response = await session.request(path);
      await response.arrayBuffer();
      return { ok: response.ok };
    },
  });
  return [
    read('GET /api/plans', '/api/plans'),
    read('GET /api/clients', '/api/clients'),
    read('GET /api/clients/:clientId', `/api/clients/${readId}`),
    read('GET /api/clients/:clientId/record', `/api/clients/${readId}/record`),
    {
      name: 'PATCH /api/clients/:clientId',
      type: 'write',
      weight: 4,
      run: async () => {
        const entry = await acquire();
        try {
          entry.flip = !entry.flip;
          const response = await session.request(`/api/clients/${entry.id}`, {
            method: 'PATCH',
            body: {
              version: entry.version,
              goal: entry.flip ? 'Objetivo carga A' : 'Objetivo carga B',
            },
          });
          const data = await response.json().catch(() => null);
          if (response.ok && Number.isInteger(data?.client?.version)) {
            entry.version = data.client.version;
          }
          return { ok: response.ok };
        } finally {
          release(entry);
        }
      },
    },
  ];
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
