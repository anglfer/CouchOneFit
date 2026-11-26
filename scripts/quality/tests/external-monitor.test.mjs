import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { runExternalMonitor } from '../external-monitor.mjs';

let server;
let baseUrl;
let failMode = false;
let ingestOnline = true;
let apiDown = false;
let invalidContracts = false;
let configAvailable = true;
let interval = 5;
let uptimeS;
const ingestedRuns = [];
const calls = [];
const clientId = '189ca77a-d37f-459c-a02c-a51738f6ec71';
const accountId = 'd3694e9a-04b2-4c29-b590-32558399bc2e';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

before(async () => {
  server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    calls.push({
      url: req.url,
      monitor: Boolean(req.headers['x-observability-token']),
      requestId: req.headers['x-request-id'],
    });

    if (req.url === '/api/observability/monitor-config') {
      if (!configAvailable) return json(res, 503, {});
      return json(res, 200, {
        settings: { monitorEnabled: true, checkIntervalMinutes: interval },
      });
    }

    if (req.url === '/' && req.method === 'GET') {
      if (failMode) {
        res.statusCode = 503;
        res.end('down');
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html><title>CouchOne Fit</title><div id="root"></div></html>',
      );
      return;
    }

    if (req.url === '/api/health' && req.method === 'GET') {
      if (apiDown) return json(res, 503, { status: 'unavailable' });
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          ...(uptimeS === undefined ? {} : { uptimeS }),
        }),
      );
      return;
    }

    if (req.url === '/api/ready' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      if (failMode) {
        res.statusCode = 503;
        res.end(
          JSON.stringify({ status: 'unavailable', database: 'unavailable' }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          status: 'ok',
          database: 'ok',
          ...(uptimeS === undefined ? {} : { uptimeS }),
        }),
      );
      return;
    }

    if (req.url === '/api/plans' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ plans: [{ id: 'basic', name: 'Básico 10' }] }));
      return;
    }

    if (req.url === '/api/observability-probe-not-found') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'Recurso no disponible.' },
        }),
      );
      return;
    }

    if (req.url === '/api/admin/session') {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: { code: 'SESSION_REQUIRED', message: 'Sin sesión' },
        }),
      );
      return;
    }

    if (req.url === '/api/auth/csrf') {
      const csrfToken = 'a'.repeat(43);
      res.setHeader('Set-Cookie', `cof_csrf=${csrfToken}; HttpOnly`);
      return json(res, 200, { csrfToken });
    }
    if (req.url === '/api/auth/login') {
      res.setHeader('Set-Cookie', [
        'cof_access=synthetic-cookie; HttpOnly',
        'cof_refresh=synthetic-refresh; HttpOnly',
      ]);
      return json(res, 200, {
        account: { id: accountId, role: 'professional' },
      });
    }
    if (req.url === '/api/auth/client/login') {
      return json(res, 200, {
        account: { id: accountId, role: 'client' },
        session: {
          accessToken: 'synthetic-client-token',
          refreshToken: 'synthetic-refresh',
          expiresAt: '2099-06-01T00:00:00Z',
        },
      });
    }
    if (req.url === '/api/clients?pageSize=5') {
      return json(res, 200, {
        clients: [{ id: clientId }],
        pageInfo: { pageSize: 5, hasMore: false, nextCursor: null },
      });
    }
    if (req.url === `/api/clients/${clientId}/training-plans`) {
      if (invalidContracts) {
        res.setHeader('Content-Type', 'text/html');
        return res.end('<html>Unexpected proxy response</html>');
      }
      return json(res, 200, {
        versions: [],
        activeVersionId: null,
        activeRevision: 0,
        timeZone: 'America/Mexico_City',
        clientRevision: 1,
      });
    }
    if (req.url === `/api/clients/${clientId}/nutrition-plans`) {
      return json(
        res,
        200,
        invalidContracts
          ? { plans: [] }
          : {
              versions: [],
              activeVersionId: null,
              activeRevision: 0,
              canWrite: true,
            },
      );
    }
    if (req.url === `/api/clients/${clientId}/follow-up`) {
      return json(
        res,
        200,
        invalidContracts
          ? {}
          : {
              clientId,
              from: '2026-11-01',
              to: '2026-11-25',
              checkIns: [],
              bodyWeight: [],
              sessions: [],
              adherence: {},
              visibility: {},
            },
      );
    }
    if (req.url === '/api/client/profile') {
      return json(
        res,
        invalidContracts ? 502 : 200,
        invalidContracts
          ? {}
          : { profile: { id: clientId, userId: accountId, status: 'active' } },
      );
    }
    if (
      req.url === '/api/auth/logout' ||
      req.url === '/api/auth/client/logout'
    ) {
      res.statusCode = 204;
      return res.end();
    }

    if (req.url === '/api/observability/ingest' && req.method === 'POST') {
      if (
        !ingestOnline ||
        req.headers['x-observability-token'] !== 'secret-token'
      ) {
        res.statusCode = ingestOnline ? 401 : 503;
        res.end(JSON.stringify({ error: { code: 'UNAVAILABLE' } }));
        return;
      }
      ingestedRuns.push(JSON.parse(bodyText));
      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ runId: 'r1', insertedChecks: 1, duplicateChecks: 0 }),
      );
      return;
    }

    res.statusCode = 404;
    res.end('{}');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('external-monitor validates content, marks missing credentials as not_executed, and backfills after outage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cof-ext-mon-'));
  try {
    // 1. Outage + ingest down: results saved locally and queued in pending-ingest.jsonl
    failMode = true;
    ingestOnline = false;
    const outageRun = await runExternalMonitor({
      apiUrl: baseUrl,
      webUrl: baseUrl,
      environment: 'production',
      outDir: dir,
      timeoutMs: 2000,
      ingestUrl: `${baseUrl}/api/observability/ingest`,
      ingestToken: 'secret-token',
    });
    assert.equal(outageRun.status, 'partial');
    assert.deepEqual(
      outageRun.checks
        .filter((check) => check.status === 'failed')
        .map((check) => check.checkKey),
      ['web_availability', 'api_db_readiness'],
    );
    assert.ok(outageRun.notExecutedChecks >= 6);
    assert.equal(outageRun.synced, 0);
    assert.equal(outageRun.pendingSync, 1);

    const queueLines = fs
      .readFileSync(path.join(dir, 'pending-ingest.jsonl'), 'utf8')
      .trim()
      .split('\n');
    assert.equal(queueLines.length, 1);

    // 2. Recovery + ingest back online: backfills previous failed run + new passed run without losing anything
    failMode = false;
    ingestOnline = true;
    const recoveryRun = await runExternalMonitor({
      apiUrl: baseUrl,
      webUrl: baseUrl,
      environment: 'production',
      outDir: dir,
      timeoutMs: 2000,
      ingestUrl: `${baseUrl}/api/observability/ingest`,
      ingestToken: 'secret-token',
    });
    assert.equal(recoveryRun.failedChecks, 0);
    assert.ok(recoveryRun.passedChecks >= 7);
    assert.equal(recoveryRun.synced, 2);
    assert.equal(recoveryRun.pendingSync, 0);
    assert.equal(ingestedRuns.length, 2);
    assert.equal(ingestedRuns[0].run.externalRunId, outageRun.externalRunId);
    assert.equal(ingestedRuns[1].run.externalRunId, recoveryRun.externalRunId);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fixture(t) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cof-ext-mon-'));
  t.after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    calls.length = 0;
    ingestedRuns.length = 0;
    apiDown = false;
    invalidContracts = false;
    configAvailable = true;
    interval = 5;
    uptimeS = undefined;
    ingestOnline = true;
  });
  return {
    apiUrl: baseUrl,
    webUrl: baseUrl,
    timeoutMs: 2000,
    outDir,
    ingestToken: 'secret-token',
    ingestUrl: `${baseUrl}/api/observability/ingest`,
  };
}

test('functional probes verify response contracts and never persist identities or credentials', async (t) => {
  const options = {
    ...fixture(t),
    proIdentifier: 'synthetic-pro@example.invalid',
    proPassword: 'synthetic-password',
    clientIdentifier: 'synthetic-client@example.invalid',
    clientPassword: 'synthetic-client-password',
    clientId,
  };
  const healthy = await runExternalMonitor(options);
  assert.equal(healthy.failedChecks, 0);
  assert.equal(healthy.notExecutedChecks, 0);
  const loginRequest = calls.find((call) => call.url === '/api/auth/login');
  assert.match(loginRequest.requestId ?? '', /^[0-9a-f-]{36}$/);
  assert.equal(
    healthy.checks.find(
      (check) => check.checkKey === 'func_auth_professional_login',
    ).correlationId,
    loginRequest.requestId,
  );

  invalidContracts = true;
  const invalid = await runExternalMonitor(options);
  const checksByKey = Object.fromEntries(
    invalid.checks.map((check) => [check.checkKey, check]),
  );
  for (const key of [
    'func_training_query',
    'func_nutrition_query',
    'func_followup_query',
  ]) {
    assert.equal(checksByKey[key].status, 'failed', key);
    assert.equal(checksByKey[key].httpStatus, 200);
  }
  const profile = checksByKey.func_client_auth_and_modules;
  assert.equal(profile.status, 'failed');
  assert.equal(profile.httpStatus, 502);
  assert.ok(profile.durationMs >= 0);
  assert.equal(checksByKey.func_client_login.status, 'passed');
  assert.equal(calls.find((call) => call.url === '/').monitor, false);
  assert.equal(
    calls.find((call) => call.url === '/api/auth/login').monitor,
    true,
  );
  const evidence = JSON.stringify(ingestedRuns);
  for (const sensitive of [
    clientId,
    accountId,
    options.proIdentifier,
    options.proPassword,
    'synthetic-client-token',
    'Unexpected proxy response',
  ]) {
    assert.ok(!evidence.includes(sensitive));
  }
});

test('a failed API probe records dependent checks as not executed without repeat requests', async (t) => {
  const options = fixture(t);
  apiDown = true;
  const result = await runExternalMonitor(options);
  assert.equal(result.failedChecks, 1);
  for (const key of [
    'api_db_readiness',
    'web_proxy_readiness',
    'func_clients_query',
    'func_plans_catalog',
    'func_client_auth_and_modules',
  ]) {
    assert.equal(
      result.checks.find((check) => check.checkKey === key)?.status,
      'not_executed',
      key,
    );
  }
  assert.ok(!calls.some((call) => call.url === '/api/ready'));
  assert.ok(!calls.some((call) => call.url === '/api/plans'));
});

test('an omitted client ID never redirects professional probes to the first client', async (t) => {
  const result = await runExternalMonitor({
    ...fixture(t),
    proIdentifier: 'synthetic-pro@example.invalid',
    proPassword: 'synthetic-password',
  });
  assert.equal(
    result.checks.find((check) => check.checkKey === 'func_clients_query')
      ?.status,
    'passed',
  );
  assert.equal(
    result.checks.find((check) => check.checkKey === 'func_training_query')
      ?.status,
    'not_executed',
  );
  assert.ok(!calls.some((call) => call.url.includes(clientId)));
});

test('scheduled slots respect cached settings and backfill missed checks without treating them as outages', async (t) => {
  const options = fixture(t);
  let clock = new Date('2026-11-25T12:02:55Z');
  const scheduled = () =>
    runExternalMonitor({ ...options, respectSchedule: true, now: () => clock });
  interval = 15;
  const first = await scheduled();
  assert.equal(first.skipped, false);

  clock = new Date('2026-11-25T12:07:00Z');
  calls.length = 0;
  const early = await scheduled();
  assert.equal(early.skipped, true);
  assert.deepEqual(calls, []);

  clock = new Date('2026-11-25T12:33:00Z');
  configAvailable = false;
  await runExternalMonitor({ ...options, force: true, now: () => clock });
  await scheduled();
  const missed = ingestedRuns.filter(
    ({ run }) => run.status === 'not_executed',
  );
  assert.equal(missed.length, 1);
  assert.equal(missed[0].run.startedAt, '2026-11-25T12:15:00.000Z');
  assert.ok(
    missed[0].checks.every(
      (check) =>
        check.status === 'not_executed' &&
        check.errorCode === 'SCHEDULE_SLOT_MISSED' &&
        check.durationMs === null,
    ),
  );
  await scheduled();
  assert.equal(
    ingestedRuns.filter(({ run }) => run.status === 'not_executed').length,
    1,
  );
});

test('replay sends saved batches without probing the application or creating a new run', async (t) => {
  const options = fixture(t);
  ingestOnline = false;
  const result = await runExternalMonitor(options);
  assert.equal(result.pendingSync, 1);
  assert.equal(result.failedChecks, 0);

  calls.length = 0;
  ingestOnline = true;
  const replay = await runExternalMonitor({ ...options, replayOnly: true });
  assert.equal(replay.synced, 1);
  assert.equal(replay.pendingSync, 0);
  assert.deepEqual(
    calls.map((call) => call.url),
    ['/api/observability/ingest'],
  );
  assert.equal(ingestedRuns[0].run.externalRunId, result.externalRunId);
});

test('probes of /api/health and /api/ready detect cold starts from uptimeS', async (t) => {
  const options = fixture(t);
  const phases = (result) =>
    Object.fromEntries(
      result.checks.map((check) => [check.checkKey, check.phase]),
    );

  // API antigua sin uptimeS: nunca falla y todo es regular.
  const legacy = await runExternalMonitor(options);
  assert.equal(legacy.failedChecks, 0);
  assert.ok(legacy.checks.every((check) => check.phase === 'regular'));

  // Proceso recién arrancado: uptime menor que la duración de la respuesta + 1 s.
  uptimeS = 0;
  const cold = phases(await runExternalMonitor(options));
  assert.equal(cold.api_liveness, 'cold_start');
  assert.equal(cold.api_db_readiness, 'cold_start');
  assert.equal(cold.web_proxy_readiness, 'cold_start');
  assert.equal(cold.web_availability, 'regular');
  assert.equal(cold.func_plans_catalog, 'regular');
  const probes = fs
    .readFileSync(
      path.join(
        options.outDir,
        fs.readdirSync(options.outDir).find((f) => f.startsWith('synthetic-')),
      ),
      'utf8',
    )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(
    probes.some(
      (probe) => probe.target.endsWith('/api/ready') && probe.phase === 'cold_start',
    ),
  );
  assert.ok(
    probes.some((probe) => probe.target.endsWith('/') && probe.phase === 'regular'),
  );

  // Proceso con horas de uptime: regular.
  uptimeS = 3600;
  const warm = phases(await runExternalMonitor(options));
  assert.equal(warm.api_liveness, 'regular');
  assert.equal(warm.api_db_readiness, 'regular');
  assert.equal(warm.web_proxy_readiness, 'regular');
});

test('without cached settings the schedule defaults to 30 minutes', async (t) => {
  const options = { ...fixture(t), ingestToken: '', ingestUrl: '' };
  let clock = new Date('2026-11-25T12:02:55Z');
  const scheduled = () =>
    runExternalMonitor({ ...options, respectSchedule: true, now: () => clock });
  assert.equal((await scheduled()).skipped, false);
  clock = new Date('2026-11-25T12:27:00Z');
  assert.equal((await scheduled()).reason, 'interval_not_elapsed');
  clock = new Date('2026-11-25T12:33:00Z');
  assert.equal((await scheduled()).skipped, false);
});

test('one replay drains several pending batches (cap is 100 per run)', async (t) => {
  const options = fixture(t);
  ingestOnline = false;
  for (let index = 0; index < 3; index += 1) {
    await runExternalMonitor({
      ...options,
      now: () => new Date(Date.UTC(2026, 10, 25, 12, index)),
    });
  }
  ingestOnline = true;
  const replay = await runExternalMonitor({ ...options, replayOnly: true });
  assert.equal(replay.synced, 3);
  assert.equal(replay.pendingSync, 0);
});
