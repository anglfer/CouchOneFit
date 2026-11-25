// Informe de SLI/SLO a partir de logs de la API, sondeos sintéticos y carga.
//
// Definiciones (percentiles por rango más cercano):
//  - Solo cuentan eventos `http.request` cuyo `path` no coincide con
//    `exclusions.paths` (salud/liveness no representan al usuario).
//  - server_error_rate_pct = peticiones con status >= 500 / peticiones * 100.
//  - operation_success_rate_pct: sobre operaciones de escritura
//    (POST/PUT/PATCH/DELETE). Éxito = status 2xx/3xx. Fallo = status >= 500 o
//    evento `http.aborted`. Los 4xx se excluyen: son rechazos correctos del
//    servidor. tasa = éxitos / (éxitos + fallos) * 100.
//  - latency_mean_ms / p50 / p95 / p99: sobre `durationMs` del servidor, de
//    todas las peticiones contadas.
//  - Cada SLI se calcula en total y por servicio (primer `services[].match`).
//  - synthetic_availability_pct = sondeos ok / sondeos * 100 (por destino y
//    total), sin los sondeos cuya `phase` está en
//    `exclusions.syntheticPhases` (p. ej. el simulacro de reinicio provocado).
//  - synthetic_latency_*: percentiles (nearest-rank) de durationMs de los
//    sondeos exitosos contados para disponibilidad; mide la latencia vista
//    desde fuera (red + TLS + API + BD).
//  - recovery_time_s: por destino, una interrupción es una racha máxima de
//    sondeos fallidos; su duración va del primer sondeo fallido al siguiente
//    sondeo exitoso. Se reportan cantidad, media y máximo (el SLO compara el
//    máximo). Una interrupción sin sondeo exitoso posterior queda 'abierta' y
//    nunca cuenta como recuperada; mientras esté abierta el SLO no concluye
//    salvo que ya supere el objetivo.
//  - load_throughput_rps = mínimo de throughput entre los escenarios de carga.
//  - Resultado por SLO: 'cumple' | 'no cumple' | 'sin datos suficientes'.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  extent,
  mean,
  parseCliArgs,
  percentile,
  readJsonlInputs,
  REPO_ROOT,
  round,
} from './lib/common.mjs';

export const DEFAULT_CONFIG = path.join(
  REPO_ROOT,
  'scripts',
  'quality',
  'slo.config.json'
);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function loadConfig(file = DEFAULT_CONFIG) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pct(part, total) {
  return total > 0 ? (part / total) * 100 : null;
}

function isExcluded(config, requestPath) {
  return (config.exclusions?.paths ?? []).some((pattern) =>
    new RegExp(pattern).test(requestPath ?? '')
  );
}

export function serviceOf(config, requestPath) {
  for (const service of config.services ?? []) {
    if (new RegExp(service.match).test(requestPath ?? '')) return service.id;
  }
  return null;
}

// SLI HTTP de un conjunto de eventos ya filtrado (requests + aborted).
export function computeHttpSli(requests, aborted = []) {
  const durations = requests
    .map((event) => event.durationMs)
    .filter((value) => Number.isFinite(value));
  const serverErrors = requests.filter((event) => event.status >= 500).length;
  let success = 0;
  let failure = 0;
  for (const event of requests) {
    if (!MUTATING.has(String(event.method).toUpperCase())) continue;
    if (event.status >= 500) failure += 1;
    else if (event.status >= 200 && event.status < 400) success += 1;
  }
  for (const event of aborted) {
    if (MUTATING.has(String(event.method).toUpperCase())) failure += 1;
  }
  return {
    requestsTotal: requests.length,
    serverErrors,
    serverErrorRatePct: round(pct(serverErrors, requests.length)),
    operations: {
      samples: success + failure,
      success,
      failure,
      successRatePct: round(pct(success, success + failure)),
    },
    latencyMs: {
      samples: durations.length,
      mean: round(mean(durations)),
      p50: round(percentile(durations, 50)),
      p95: round(percentile(durations, 95)),
      p99: round(percentile(durations, 99)),
    },
  };
}

export function computeHttp(events, config) {
  const requests = events.filter(
    (event) => event.event === 'http.request' && !isExcluded(config, event.path)
  );
  const aborted = events.filter(
    (event) => event.event === 'http.aborted' && !isExcluded(config, event.path)
  );
  const overall = computeHttpSli(requests, aborted);
  const perService = {};
  for (const service of config.services ?? []) {
    const inService = (event) => serviceOf(config, event.path) === service.id;
    const serviceRequests = requests.filter(inService);
    const serviceAborted = aborted.filter(inService);
    if (serviceRequests.length || serviceAborted.length) {
      perService[service.id] = {
        name: service.name,
        ...computeHttpSli(serviceRequests, serviceAborted),
      };
    }
  }
  return { overall, perService };
}

// Interrupciones por destino a partir de sondeos ordenados por tiempo.
export function computeOutages(probes) {
  const sorted = [...probes].sort(
    (a, b) => Date.parse(a.ts) - Date.parse(b.ts)
  );
  const recovered = [];
  let openSince = null;
  for (const probe of sorted) {
    if (!probe.ok) {
      if (openSince === null) openSince = probe.ts;
    } else if (openSince !== null) {
      recovered.push({
        from: openSince,
        to: probe.ts,
        durationS: (Date.parse(probe.ts) - Date.parse(openSince)) / 1000,
      });
      openSince = null;
    }
  }
  const lastTs = sorted.length ? Date.parse(sorted.at(-1).ts) : 0;
  const open =
    openSince === null
      ? null
      : { from: openSince, elapsedS: (lastTs - Date.parse(openSince)) / 1000 };
  return { recovered, open };
}

// Latencia de sondeos exitosos (los fallidos ya penalizan la disponibilidad).
function probeLatency(countedProbes) {
  const durations = countedProbes
    .filter((probe) => probe.ok === true)
    .map((probe) => probe.durationMs)
    .filter((value) => Number.isFinite(value));
  return {
    samples: durations.length,
    mean: round(mean(durations)),
    p50: round(percentile(durations, 50)),
    p95: round(percentile(durations, 95)),
    p99: round(percentile(durations, 99)),
  };
}

export function computeSynthetic(events, config = {}) {
  const probes = events.filter((event) => event.event === 'synthetic.probe');
  const excludedPhases = new Set(config.exclusions?.syntheticPhases ?? []);
  const counted = (list) =>
    list.filter((probe) => !excludedPhases.has(probe.phase));
  const byTarget = new Map();
  for (const probe of probes) {
    if (!byTarget.has(probe.target)) byTarget.set(probe.target, []);
    byTarget.get(probe.target).push(probe);
  }
  const targets = {};
  const allRecovered = [];
  let openOutages = 0;
  let openElapsedMax = 0;
  for (const [target, list] of byTarget) {
    const availabilityProbes = counted(list);
    const okCount = availabilityProbes.filter((probe) => probe.ok).length;
    const outages = computeOutages(list);
    const durations = outages.recovered.map((item) => item.durationS);
    allRecovered.push(...durations);
    if (outages.open) {
      openOutages += 1;
      openElapsedMax = Math.max(openElapsedMax, outages.open.elapsedS);
    }
    targets[target] = {
      probes: availabilityProbes.length,
      excludedProbes: list.length - availabilityProbes.length,
      okProbes: okCount,
      availabilityPct: round(pct(okCount, availabilityProbes.length)),
      latencyMs: probeLatency(availabilityProbes),
      outages: {
        recovered: durations.length,
        meanS: round(mean(durations)),
        maxS: round(durations.length ? Math.max(...durations) : null),
        open: outages.open
          ? {
              estado: 'abierta',
              desde: outages.open.from,
              transcurridosS: round(outages.open.elapsedS),
            }
          : null,
      },
    };
  }
  const availabilityTotal = counted(probes);
  const okTotal = availabilityTotal.filter((probe) => probe.ok).length;
  return {
    probes: availabilityTotal.length,
    excludedProbes: probes.length - availabilityTotal.length,
    availabilityPct: round(pct(okTotal, availabilityTotal.length)),
    latencyMs: probeLatency(availabilityTotal),
    recovery: {
      recovered: allRecovered.length,
      meanS: round(mean(allRecovered)),
      maxS: round(allRecovered.length ? Math.max(...allRecovered) : null),
      openOutages,
      openElapsedMaxS: round(openElapsedMax),
    },
    targets,
  };
}

export function computeLoad(events) {
  const scenarios = events
    .filter((event) => event.event === 'load.scenario')
    .map((event) => ({
      scenario: event.scenario,
      path: event.path,
      concurrency: event.concurrency,
      requests: event.requests,
      errorRate: event.errorRate,
      throughputRps: event.throughputRps,
      latencyMs: event.latencyMs,
    }));
  const throughputs = scenarios
    .map((item) => item.throughputRps)
    .filter(Number.isFinite);
  return {
    scenarios,
    throughputMinRps: throughputs.length
      ? round(Math.min(...throughputs))
      : null,
  };
}

// SLIs planos (valor + muestras) referenciados por `slos[].sli`.
export function buildSlis(http, synthetic, load) {
  const overall = http.overall;
  const recovery = synthetic.recovery;
  const hasOutage = recovery.recovered + recovery.openOutages;
  const recoveryValue =
    recovery.openOutages > 0
      ? Math.max(recovery.maxS ?? 0, recovery.openElapsedMaxS ?? 0)
      : recovery.maxS;
  return {
    server_error_rate_pct: {
      value: overall.serverErrorRatePct,
      samples: overall.requestsTotal,
    },
    operation_success_rate_pct: {
      value: overall.operations.successRatePct,
      samples: overall.operations.samples,
    },
    latency_mean_ms: {
      value: overall.latencyMs.mean,
      samples: overall.latencyMs.samples,
    },
    latency_p50_ms: {
      value: overall.latencyMs.p50,
      samples: overall.latencyMs.samples,
    },
    latency_p95_ms: {
      value: overall.latencyMs.p95,
      samples: overall.latencyMs.samples,
    },
    latency_p99_ms: {
      value: overall.latencyMs.p99,
      samples: overall.latencyMs.samples,
    },
    synthetic_availability_pct: {
      value: synthetic.availabilityPct,
      samples: synthetic.probes,
    },
    synthetic_latency_p95_ms: {
      value: synthetic.latencyMs.p95,
      samples: synthetic.latencyMs.samples,
    },
    recovery_time_s: {
      value: hasOutage ? recoveryValue : null,
      samples: hasOutage,
      open: recovery.openOutages,
    },
    load_throughput_rps: {
      value: load.throughputMinRps,
      samples: load.scenarios.length,
    },
  };
}

function compare(value, comparison, target) {
  switch (comparison) {
    case '>=':
      return value >= target;
    case '<=':
      return value <= target;
    case '>':
      return value > target;
    case '<':
      return value < target;
    default:
      throw new Error(`Comparación no soportada: ${comparison}`);
  }
}

export function evaluateSlos(config, slis) {
  return (config.slos ?? []).map((slo) => {
    const sli = slis[slo.sli];
    const base = {
      id: slo.id,
      sli: slo.sli,
      target: slo.target,
      comparison: slo.comparison,
      unit: slo.unit,
      minSamples: slo.minSamples ?? 1,
      value: sli?.value ?? null,
      samples: sli?.samples ?? 0,
    };
    if (sli?.value == null || base.samples < base.minSamples) {
      return { ...base, status: 'sin datos suficientes' };
    }
    const meets = compare(sli.value, slo.comparison, slo.target);
    // Con una interrupción abierta y dentro del objetivo aún no se sabe si
    // se recuperará a tiempo: no se declara cumplimiento.
    if (meets && sli.open > 0) {
      return {
        ...base,
        status: 'sin datos suficientes',
        note: 'interrupción abierta',
      };
    }
    return { ...base, status: meets ? 'cumple' : 'no cumple' };
  });
}

export function buildReport({
  config,
  logs = [],
  synthetic = [],
  load = [],
  inputs = {},
}) {
  const logInput = readJsonlInputs(logs);
  const synInput = readJsonlInputs(synthetic);
  const loadInput = readJsonlInputs(load);
  const http = computeHttp(logInput.events, config);
  const syn = computeSynthetic(synInput.events, config);
  const loadSummary = computeLoad(loadInput.events);
  const slis = buildSlis(http, syn, loadSummary);
  const timestamps = [
    ...logInput.events.filter((e) => String(e.event).startsWith('http.')),
    ...synInput.events.filter((e) => e.event === 'synthetic.probe'),
    ...loadInput.events.filter((e) => e.event === 'load.scenario'),
  ]
    .map((event) => Date.parse(event.ts))
    .filter(Number.isFinite);
  const period = extent(timestamps);
  return {
    generatedAt: new Date().toISOString(),
    configVersion: config.version,
    inputs: { logs, synthetic, load, ...inputs },
    files: {
      logs: logInput.files.length,
      synthetic: synInput.files.length,
      load: loadInput.files.length,
      missing: [...logInput.missing, ...synInput.missing, ...loadInput.missing],
    },
    malformedLines:
      logInput.malformedLines +
      synInput.malformedLines +
      loadInput.malformedLines,
    period: {
      start: period.min === null ? null : new Date(period.min).toISOString(),
      end: period.max === null ? null : new Date(period.max).toISOString(),
    },
    samples: {
      httpRequests: http.overall.requestsTotal,
      probes: syn.probes,
      loadScenarios: loadSummary.scenarios.length,
    },
    slis,
    http: http.overall,
    perService: http.perService,
    synthetic: syn,
    load: loadSummary,
    slos: evaluateSlos(config, slis),
  };
}

const fmt = (value, digits = 2) =>
  value === null || value === undefined ? 'n/d' : String(round(value, digits));

export function renderMarkdown(report) {
  const lines = ['# Informe de SLI/SLO', ''];
  lines.push(
    `Periodo: ${report.period.start ?? 'n/d'} a ${report.period.end ?? 'n/d'}`,
    '',
    `Muestras: ${report.samples.httpRequests} peticiones HTTP, ${report.samples.probes} sondeos sintéticos, ${report.samples.loadScenarios} escenarios de carga. Líneas mal formadas: ${report.malformedLines}.`,
    '',
    '## Objetivos (SLO)',
    '',
    '| SLO | SLI | Objetivo | Valor | Muestras | Resultado |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  for (const slo of report.slos) {
    lines.push(
      `| ${slo.id} | ${slo.sli} | ${slo.comparison} ${slo.target} ${slo.unit} | ${fmt(slo.value)} | ${slo.samples} | ${slo.status}${slo.note ? ` (${slo.note})` : ''} |`
    );
  }
  const services = Object.entries(report.perService);
  if (services.length) {
    lines.push(
      '',
      '## Por servicio',
      '',
      '| Servicio | Peticiones | Errores 5xx % | Éxito operaciones % | p50 ms | p95 ms | p99 ms |',
      '| --- | --- | --- | --- | --- | --- | --- |'
    );
    for (const [id, item] of services) {
      lines.push(
        `| ${item.name} (${id}) | ${item.requestsTotal} | ${fmt(item.serverErrorRatePct)} | ${fmt(item.operations.successRatePct)} | ${fmt(item.latencyMs.p50)} | ${fmt(item.latencyMs.p95)} | ${fmt(item.latencyMs.p99)} |`
      );
    }
  }
  const targets = Object.entries(report.synthetic.targets);
  if (targets.length) {
    lines.push(
      '',
      '## Disponibilidad sintética',
      '',
      '| Destino | Sondeos | Disponibilidad % | p50 ms | p95 ms | Interrupciones recuperadas | Media s | Máx s | Abierta |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    );
    for (const [target, item] of targets) {
      lines.push(
        `| ${target} | ${item.probes} | ${fmt(item.availabilityPct)} | ${fmt(item.latencyMs.p50)} | ${fmt(item.latencyMs.p95)} | ${item.outages.recovered} | ${fmt(item.outages.meanS)} | ${fmt(item.outages.maxS)} | ${item.outages.open ? `abierta (${fmt(item.outages.open.transcurridosS)} s)` : 'no'} |`
      );
    }
  }
  if (report.load.scenarios.length) {
    lines.push(
      '',
      '## Carga',
      '',
      '| Escenario | Concurrencia | Peticiones | Errores % | rps | p50 ms | p95 ms | p99 ms |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |'
    );
    for (const item of report.load.scenarios) {
      lines.push(
        `| ${item.scenario} | ${item.concurrency} | ${item.requests} | ${fmt(item.errorRate)} | ${fmt(item.throughputRps)} | ${fmt(item.latencyMs?.p50)} | ${fmt(item.latencyMs?.p95)} | ${fmt(item.latencyMs?.p99)} |`
      );
    }
  }
  lines.push(
    '',
    'La disponibilidad se observa y reporta; no constituye un SLA contractual.',
    ''
  );
  return lines.join('\n');
}

export function writeReport(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'sli-report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  fs.writeFileSync(path.join(outDir, 'sli-report.md'), renderMarkdown(report));
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2), {
    multi: ['logs', 'synthetic', 'load'],
    flags: ['strict'],
  });
  const logs = options.logs.length ? options.logs : ['logs/api'];
  const synthetic = options.synthetic.length
    ? options.synthetic
    : ['logs/synthetic'];
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const outDir = options.out ?? path.join('test-results', 'sli', stamp);
  const config = loadConfig(options.config ?? DEFAULT_CONFIG);
  const report = buildReport({
    config,
    logs,
    synthetic,
    load: options.load,
  });
  writeReport(report, outDir);
  for (const slo of report.slos) {
    console.log(
      `${slo.id}: ${slo.status} (valor ${fmt(slo.value)} ${slo.unit})`
    );
  }
  console.log(`Informe: ${outDir}`);
  if (options.strict && report.slos.some((slo) => slo.status === 'no cumple')) {
    process.exitCode = 1;
  }
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
