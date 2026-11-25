// Sondeos sintéticos de disponibilidad (GET, solo estado; jamás el cuerpo).
// Uso: node scripts/quality/synthetic-check.mjs --target <url> [--target ...]
//   [--interval 60] [--count 1 | --duration <s>] [--timeout 65000]
//   [--out logs/synthetic]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendJsonl, parseCliArgs, round, utcDay } from './lib/common.mjs';

function describeError(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return 'timeout';
  }
  const code = error?.cause?.code ?? error?.code;
  return String(code ?? error?.message ?? error);
}

export async function probe(
  target,
  { timeoutMs = 65000, fetchImpl = fetch } = {}
) {
  const started = performance.now();
  const ts = new Date().toISOString();
  let status = null;
  let error = null;
  try {
    const response = await fetchImpl(target, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    // No se lee ni se registra el cuerpo: se libera la conexión.
    await response.body?.cancel();
  } catch (caught) {
    error = describeError(caught);
  }
  return {
    ts,
    event: 'synthetic.probe',
    target,
    ok: status !== null && status >= 200 && status < 300,
    status,
    durationMs: round(performance.now() - started, 1),
    error,
  };
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', done);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

// Ejecuta rondas de sondeos (todos los destinos en paralelo por ronda).
// Termina por `count`, `durationS` o al abortar `signal`.
export async function runProbes({
  targets,
  intervalS = 60,
  count = 1,
  durationS = null,
  timeoutMs = 65000,
  outDir = 'logs/synthetic',
  signal = null,
  onProbe = null,
  fetchImpl = fetch,
  phase = null,
}) {
  const results = [];
  const last = new Map();
  const deadline =
    durationS === null ? null : performance.now() + durationS * 1000;
  for (let round_ = 0; ; round_ += 1) {
    const roundStart = performance.now();
    const batch = await Promise.all(
      targets.map((target) => probe(target, { timeoutMs, fetchImpl }))
    );
    for (const result of batch) {
      if (phase) result.phase = phase;
      appendJsonl(
        path.join(outDir, `synthetic-${utcDay(new Date(result.ts))}.jsonl`),
        result
      );
      results.push(result);
      last.set(result.target, result);
      onProbe?.(result);
    }
    if (signal?.aborted) break;
    if (deadline === null && round_ + 1 >= count) break;
    const wait = Math.max(
      0,
      intervalS * 1000 - (performance.now() - roundStart)
    );
    if (deadline !== null && performance.now() + wait >= deadline) break;
    await sleep(wait, signal);
    if (signal?.aborted) break;
  }
  return { results, last };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2), { multi: ['target'] });
  if (!options.target.length) {
    throw new Error('Indica al menos un --target <url>.');
  }
  const durationS =
    options.duration === undefined ? null : Number(options.duration);
  const { last } = await runProbes({
    targets: options.target,
    intervalS: Number(options.interval ?? 60),
    count: Number(options.count ?? 1),
    durationS,
    timeoutMs: Number(options.timeout ?? 65000),
    outDir: options.out ?? 'logs/synthetic',
    onProbe: (result) =>
      console.log(
        `${result.ts} ${result.ok ? 'OK ' : 'FALLO'} ${result.status ?? '-'} ${result.durationMs} ms ${result.target}${result.error ? ` (${result.error})` : ''}`
      ),
  });
  if ([...last.values()].some((result) => !result.ok)) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
