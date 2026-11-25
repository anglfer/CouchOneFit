import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  extent,
  gzipJsonlFiles,
  percentile,
  readJsonlInputs,
} from '../lib/common.mjs';
import {
  buildReport,
  computeHttp,
  buildSlis,
  computeOutages,
  computeSynthetic,
  evaluateSlos,
  loadConfig,
  renderMarkdown,
} from '../sli-report.mjs';

const config = loadConfig();
const req = (method, route, status, durationMs, extra = {}) => ({
  ts: '2026-01-01T00:00:00.000Z',
  event: 'http.request',
  method,
  path: route,
  status,
  durationMs,
  ...extra,
});
const probeAt = (second, ok, target = 'http://x/ready') => ({
  ts: new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString(),
  event: 'synthetic.probe',
  target,
  ok,
  status: ok ? 200 : null,
  durationMs: 5,
  error: ok ? null : 'ECONNREFUSED',
});

test('percentile uses nearest rank and handles edge cases', () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([7], 99), 7);
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 0), 1);
  assert.equal(percentile([1, 2, 3, 4], 100), 4);
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 95), 95);
  assert.equal(percentile(hundred, 99), 99);
  assert.equal(percentile([10, 20], 95), 20);
});

test('HTTP SLIs: server errors, exclusions, 4xx and aborted operations', () => {
  const events = [
    req('GET', '/api/plans', 200, 10),
    req('GET', '/api/plans', 200, 20),
    req('GET', '/api/health', 200, 1),
    req('GET', '/api/health/ready', 503, 1),
    req('POST', '/api/auth/login', 200, 100),
    req('POST', '/api/auth/login', 401, 50),
    req('POST', '/api/clients', 500, 300),
    req('PATCH', '/api/clients/:id', 204, 40),
    {
      event: 'http.aborted',
      method: 'POST',
      path: '/api/clients',
      durationMs: 5,
    },
    { event: 'http.aborted', method: 'GET', path: '/api/plans', durationMs: 5 },
    {
      event: 'http.aborted',
      method: 'POST',
      path: '/api/health',
      durationMs: 5,
    },
  ];
  const { overall, perService } = computeHttp(events, config);
  assert.equal(overall.requestsTotal, 6);
  assert.equal(overall.serverErrors, 1);
  assert.equal(overall.serverErrorRatePct, 16.667);
  // exitos: login 200, PATCH 204; fallos: POST 500 + aborted POST; 401 excluido.
  assert.deepEqual(
    [
      overall.operations.success,
      overall.operations.failure,
      overall.operations.samples,
    ],
    [2, 2, 4]
  );
  assert.equal(overall.operations.successRatePct, 50);
  assert.equal(overall.latencyMs.samples, 6);
  assert.equal(overall.latencyMs.p50, 40);
  assert.equal(perService.plans.requestsTotal, 2);
  assert.equal(perService.auth.requestsTotal, 2);
  assert.equal(perService.auth.operations.successRatePct, 100);
  assert.equal(perService.clients.operations.failure, 2);
  assert.equal(perService.clients.requestsTotal, 2);
  assert.equal(perService.admin, undefined);
});

test('outages are measured from the first failed probe to recovery', () => {
  const probes = [
    probeAt(0, true),
    probeAt(1, false),
    probeAt(2, false),
    probeAt(5, true),
    probeAt(6, false),
    probeAt(9, false),
  ];
  const { recovered, open } = computeOutages(probes);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].durationS, 4);
  assert.equal(open.elapsedS, 3);
  const synthetic = computeSynthetic(probes);
  assert.equal(synthetic.availabilityPct, 33.333);
  assert.equal(synthetic.recovery.recovered, 1);
  assert.equal(synthetic.recovery.maxS, 4);
  assert.equal(synthetic.recovery.openOutages, 1);
  assert.equal(
    synthetic.targets['http://x/ready'].outages.open.estado,
    'abierta'
  );
});

test('gzipped JSONL logs are read back identically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gz-'));
  try {
    const line = JSON.stringify(req('GET', '/api/plans', 200, 3));
    fs.writeFileSync(path.join(dir, 'api-2026-01-01.jsonl'), `${line}\n`);
    gzipJsonlFiles(dir);
    assert.deepEqual(fs.readdirSync(dir), ['api-2026-01-01.jsonl.gz']);
    const { events, malformedLines } = readJsonlInputs([dir]);
    assert.equal(events.length, 1);
    assert.equal(events[0].path, '/api/plans');
    assert.equal(malformedLines, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('extent handles load-sized inputs without stack overflow', () => {
  const values = Array.from({ length: 300_000 }, (_, i) => i);
  assert.deepEqual(extent(values), { min: 0, max: 299_999 });
  assert.deepEqual(extent([]), { min: null, max: null });
});

test('provoked drill outages count for recovery but not availability', () => {
  const drill = (second, ok) => ({
    ...probeAt(second, ok),
    phase: 'recovery-drill',
  });
  const probes = [
    probeAt(0, true),
    probeAt(1, true),
    drill(2, false),
    drill(6, true),
  ];
  const synthetic = computeSynthetic(probes, {
    exclusions: { syntheticPhases: ['recovery-drill'] },
  });
  assert.equal(synthetic.availabilityPct, 100);
  assert.equal(synthetic.probes, 2);
  assert.equal(synthetic.excludedProbes, 2);
  assert.equal(synthetic.recovery.maxS, 4);
  assert.equal(computeSynthetic(probes).availabilityPct, 75);
});

test('synthetic latency uses only counted successful probes', () => {
  const withDuration = (probe, durationMs, extra = {}) => ({
    ...probe,
    durationMs,
    ...extra,
  });
  const a = 'http://a/ready';
  const b = 'http://b/ready';
  const probes = [
    withDuration(probeAt(0, true, a), 100),
    withDuration(probeAt(1, true, a), 200),
    withDuration(probeAt(2, true, a), 300),
    withDuration(probeAt(3, true, a), 400),
    withDuration(probeAt(4, false, a), 65000),
    withDuration(probeAt(5, true, a), 90000, { phase: 'recovery-drill' }),
    withDuration(probeAt(6, true, b), 50),
    withDuration(probeAt(7, true, b), 150),
  ];
  const cfg = { exclusions: { syntheticPhases: ['recovery-drill'] } };
  const synthetic = computeSynthetic(probes, cfg);
  assert.equal(synthetic.targets[a].latencyMs.samples, 4);
  assert.equal(synthetic.targets[a].latencyMs.p50, 200);
  assert.equal(synthetic.targets[a].latencyMs.p95, 400);
  assert.equal(synthetic.targets[b].latencyMs.p50, 50);
  assert.equal(synthetic.targets[b].latencyMs.p95, 150);
  assert.equal(synthetic.latencyMs.samples, 6);
  assert.equal(synthetic.latencyMs.p95, 400);

  const http = computeHttp([], config);
  const load = { scenarios: [], throughputMinRps: null };
  const slos = (syn) =>
    Object.fromEntries(
      evaluateSlos(config, buildSlis(http, syn, load)).map((slo) => [
        slo.id,
        slo.status,
      ])
    );
  assert.equal(
    slos(synthetic)['synthetic-latency-p95'],
    'sin datos suficientes'
  );
  const many = Array.from({ length: 20 }, (_, i) =>
    withDuration(probeAt(i, true), 120)
  );
  assert.equal(
    slos(computeSynthetic(many, cfg))['synthetic-latency-p95'],
    'cumple'
  );
});

test('SLO evaluation: cumple, no cumple and sin datos suficientes', () => {
  const slis = {
    server_error_rate_pct: { value: 2, samples: 10 },
    operation_success_rate_pct: { value: 100, samples: 10 },
    latency_p50_ms: { value: 10, samples: 5 },
    latency_p95_ms: { value: 900, samples: 50 },
    synthetic_availability_pct: { value: null, samples: 0 },
    load_throughput_rps: { value: 3, samples: 3 },
    recovery_time_s: { value: 10, samples: 1, open: 1 },
  };
  const result = Object.fromEntries(
    evaluateSlos(config, slis).map((slo) => [slo.id, slo.status])
  );
  assert.equal(result['error-rate'], 'no cumple');
  assert.equal(result['operation-success'], 'cumple');
  assert.equal(result['latency-p50'], 'sin datos suficientes');
  assert.equal(result['latency-p95'], 'cumple');
  assert.equal(result['latency-p99'], 'sin datos suficientes');
  assert.equal(result.availability, 'sin datos suficientes');
  assert.equal(result['load-throughput'], 'no cumple');
  assert.equal(result['recovery-time'], 'sin datos suficientes');
  const open = evaluateSlos(config, {
    recovery_time_s: { value: 90, samples: 1, open: 1 },
  }).find((slo) => slo.id === 'recovery-time');
  assert.equal(open.status, 'no cumple');
});

test('the report tolerates malformed lines and missing inputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-sli-'));
  try {
    const logs = path.join(dir, 'logs');
    fs.mkdirSync(logs);
    fs.writeFileSync(
      path.join(logs, 'api-2026-01-01.jsonl'),
      [
        JSON.stringify(req('GET', '/api/plans', 200, 12)),
        '{not json',
        '',
        '[1]',
        JSON.stringify(req('POST', '/api/clients', 500, 30)),
      ].join('\n')
    );
    const loadFile = path.join(dir, 'load.jsonl');
    fs.writeFileSync(
      loadFile,
      `${JSON.stringify({
        ts: '2026-01-01T00:00:10.000Z',
        event: 'load.scenario',
        scenario: 'plans',
        concurrency: 2,
        requests: 100,
        errorRate: 0,
        throughputRps: 50,
        latencyMs: { p50: 1, p95: 2, p99: 3 },
      })}\n`
    );
    const report = buildReport({
      config,
      logs: [logs],
      synthetic: [path.join(dir, 'nope')],
      load: [loadFile],
    });
    assert.equal(report.malformedLines, 2);
    assert.equal(report.samples.httpRequests, 2);
    assert.equal(report.slis.load_throughput_rps.value, 50);
    assert.equal(report.files.missing.length, 1);
    assert.equal(report.period.start, '2026-01-01T00:00:00.000Z');
    assert.equal(report.period.end, '2026-01-01T00:00:10.000Z');
    const status = Object.fromEntries(report.slos.map((s) => [s.id, s.status]));
    assert.equal(status.availability, 'sin datos suficientes');
    assert.equal(status['load-throughput'], 'cumple');
    assert.match(renderMarkdown(report), /# Informe de SLI\/SLO/);
    assert.equal(readJsonlInputs([logs]).events.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with no data every SLO is sin datos suficientes', () => {
  const report = buildReport({ config, logs: [], synthetic: [], load: [] });
  assert.ok(report.slos.every((slo) => slo.status === 'sin datos suficientes'));
});
