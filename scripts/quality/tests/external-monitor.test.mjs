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
let readyFails = false;
let loginFails = false;
// 'rotate' emite credenciales nuevas; 'same' repite las anteriores; 'denied' responde 401.
let refreshMode = 'rotate';
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
      method: req.method,
      url: req.url,
      monitor: Boolean(req.headers['x-observability-token']),
      requestId: req.headers['x-request-id'],
      cookie: req.headers.cookie ?? '',
      authorization: req.headers.authorization ?? '',
      origin: req.headers.origin ?? '',
      csrf: req.headers['x-csrf-token'] ?? '',
      body: bodyText,
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
      if (failMode || apiDown || readyFails) {
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
    if (
      loginFails &&
      (req.url === '/api/auth/login' || req.url === '/api/auth/client/login')
    ) {
      return json(res, 401, { error: { code: 'INVALID_CREDENTIALS' } });
    }
    if (req.url === '/api/auth/refresh' && req.method === 'POST') {
      if (
        refreshMode === 'denied' ||
        !req.headers.cookie?.includes('cof_refresh=synthetic-refresh')
      ) {
        res.setHeader('Set-Cookie', [
          'cof_access=; Max-Age=0',
          'cof_refresh=; Max-Age=0',
        ]);
        return json(res, 401, { error: { code: 'SESSION_REQUIRED' } });
      }
      const same = refreshMode === 'same';
      res.setHeader('Set-Cookie', [
        `cof_access=${same ? 'synthetic-cookie' : 'rotated-access'}; HttpOnly`,
        `cof_refresh=${same ? 'synthetic-refresh' : 'rotated-refresh'}; HttpOnly`,
      ]);
      return json(res, 200, {
        account: { id: accountId, role: 'professional' },
      });
    }
    if (req.url === '/api/auth/client/refresh' && req.method === 'POST') {
      if (
        refreshMode === 'denied' ||
        JSON.parse(bodyText || '{}').refreshToken !== 'synthetic-refresh'
      ) {
        return json(res, 401, { error: { code: 'SESSION_REQUIRED' } });
      }
      const same = refreshMode === 'same';
      return json(res, 200, {
        account: { id: accountId, role: 'client' },
        session: {
          accessToken: same ? 'synthetic-client-token' : 'rotated-client-token',
          refreshToken: same ? 'synthetic-refresh' : 'rotated-client-refresh',
          expiresAt: '2099-06-01T00:00:00Z',
        },
      });
    }
    if (req.url === '/api/me/subscription') {
      return json(res, 200, {
        subscription: invalidContracts
          ? { status: 'bogus' }
          : {
              planId: 'basic',
              status: 'active',
              used: 1,
              cancelAtPeriodEnd: false,
            },
      });
    }
    if (req.url === '/api/training/exercises') {
      return json(
        res,
        200,
        invalidContracts
          ? { exercises: [{ id: 7 }] }
          : {
              exercises: [{ id: 'ex-1', name: 'Sentadilla' }],
              nextOffset: 40,
              filters: { muscles: [], equipment: [] },
              attribution: 'synthetic',
            },
      );
    }
    if (req.url === '/api/training/templates') {
      return json(
        res,
        200,
        invalidContracts
          ? { versions: [{ id: 'not-a-uuid', clientId: null }] }
          : {
              versions: [],
              activeVersionId: null,
              activeRevision: 0,
              timeZone: null,
              clientRevision: null,
              clientName: null,
            },
      );
    }
    if (req.url === '/api/me/record') {
      return json(
        res,
        200,
        invalidContracts
          ? { record: {} }
          : {
              record: { id: clientId, fullName: 'Synthetic Name', status: 'active' },
            },
      );
    }
    if (
      req.url === '/api/me/training-plan' ||
      req.url === '/api/me/training-sessions/context'
    ) {
      return json(res, 200, {
        clientId,
        localDate: '2026-11-26',
        today: '2026-11-26',
        timeZone: 'America/Mexico_City',
        canWrite: invalidContracts ? 'yes' : true,
        activeRevision: 0,
        plan: null,
        dayId: null,
        session: null,
      });
    }
    if (req.url === '/api/me/training-history') {
      return json(
        res,
        200,
        invalidContracts
          ? { sessions: 'none' }
          : { sessions: [], nextOffset: null },
      );
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

// Peticiones a la API de las comprobaciones (excluye ingesta y configuración).
function isApiProbe(url) {
  return url.startsWith('/api/') && !url.startsWith('/api/observability/');
}

function fixture(t) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cof-ext-mon-'));
  t.after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    calls.length = 0;
    ingestedRuns.length = 0;
    apiDown = false;
    invalidContracts = false;
    configAvailable = true;
    readyFails = false;
    loginFails = false;
    refreshMode = 'rotate';
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
  for (const key of NEW_READ_CHECKS) {
    assert.equal(checksByKey[key].status, 'failed', key);
    assert.equal(checksByKey[key].httpStatus, 200, key);
    assert.equal(checksByKey[key].assertions[0].ok, true, key);
    assert.equal(checksByKey[key].assertions[1].ok, false, key);
  }
  for (const key of ['func_auth_professional_refresh', 'func_client_refresh']) {
    assert.equal(checksByKey[key].status, 'passed', key);
  }
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
    options.clientIdentifier,
    options.clientPassword,
    'synthetic-client-token',
    'Unexpected proxy response',
  ]) {
    assert.ok(!evidence.includes(sensitive));
  }
});

const NEW_READ_CHECKS = [
  'func_subscription_query',
  'func_training_catalog_query',
  'func_training_templates_query',
  'func_client_record_query',
  'func_client_training_plan_query',
  'func_client_training_context_query',
  'func_client_training_history_query',
];

function credentialsOptions(t) {
  return {
    ...fixture(t),
    proIdentifier: 'synthetic-pro@example.invalid',
    proPassword: 'synthetic-password',
    clientIdentifier: 'synthetic-client@example.invalid',
    clientPassword: 'synthetic-client-password',
    clientId,
  };
}

test('every run starts with GET /api/ready, including the scheduled prefetch path', async (t) => {
  const options = credentialsOptions(t);
  const regular = await runExternalMonitor(options);
  assert.equal(regular.failedChecks, 0);
  assert.equal(regular.notExecutedChecks, 0);
  const regularCalls = calls.filter((call) => isApiProbe(call.url));
  assert.equal(`${regularCalls[0].method} ${regularCalls[0].url}`, 'GET /api/ready');
  assert.equal(regularCalls[1].url, '/api/health');

  // Con el calendario activo la sonda se anticipa a la consulta de configuración.
  calls.length = 0;
  const scheduled = await runExternalMonitor({
    ...options,
    respectSchedule: true,
    now: () => new Date('2026-11-25T12:02:55Z'),
  });
  assert.equal(scheduled.skipped, false);
  const scheduledCalls = calls.filter((call) => isApiProbe(call.url));
  assert.equal(scheduledCalls[0].url, '/api/ready');
  assert.equal(scheduledCalls[1].url, '/api/health');
  assert.equal(
    scheduledCalls.filter((call) => call.url === '/api/ready').length,
    1,
  );
  assert.ok(calls.some((call) => call.url === '/api/observability/monitor-config'));
});

test('read probes run once per run and refresh is the last request before logout', async (t) => {
  await runExternalMonitor(credentialsOptions(t));
  const requests = calls
    .filter((call) => isApiProbe(call.url))
    .map((call) => `${call.method} ${call.url}`);
  // 24 peticiones a la API + GET /api/health de la Web (el mock comparte servidor).
  assert.equal(requests.length, 25, requests.join('\n'));
  const index = (request) => requests.indexOf(request);
  for (const request of [
    'GET /api/me/subscription',
    'GET /api/training/exercises',
    'GET /api/training/templates',
    'GET /api/me/record',
    'GET /api/me/training-plan',
    'GET /api/me/training-sessions/context',
    'GET /api/me/training-history',
  ]) {
    assert.equal(requests.filter((item) => item === request).length, 1, request);
  }
  const proReads = [
    'GET /api/clients?pageSize=5',
    'GET /api/me/subscription',
    'GET /api/training/exercises',
    'GET /api/training/templates',
    `GET /api/clients/${clientId}/follow-up`,
  ];
  for (const request of proReads) {
    assert.ok(index(request) < index('POST /api/auth/refresh'), request);
  }
  assert.ok(index('POST /api/auth/refresh') < index('POST /api/auth/logout'));
  for (const request of [
    'GET /api/client/profile',
    'GET /api/me/record',
    'GET /api/me/training-plan',
    'GET /api/me/training-sessions/context',
    'GET /api/me/training-history',
  ]) {
    assert.ok(index(request) < index('POST /api/auth/client/refresh'), request);
  }
  assert.ok(
    index('POST /api/auth/client/refresh') <
      index('POST /api/auth/client/logout'),
  );
});

test('refresh rotates the credentials and logout uses the new ones', async (t) => {
  const result = await runExternalMonitor(credentialsOptions(t));
  const byKey = Object.fromEntries(
    result.checks.map((check) => [check.checkKey, check]),
  );
  assert.equal(byKey.func_auth_professional_refresh.status, 'passed');
  assert.equal(byKey.func_client_refresh.status, 'passed');

  const proRefresh = calls.find((call) => call.url === '/api/auth/refresh');
  assert.equal(proRefresh.method, 'POST');
  assert.ok(proRefresh.cookie.includes('cof_refresh=synthetic-refresh'));
  assert.equal(proRefresh.csrf, 'a'.repeat(43));
  assert.equal(proRefresh.origin, baseUrl);
  const proLogout = calls.find((call) => call.url === '/api/auth/logout');
  assert.ok(proLogout.cookie.includes('cof_access=rotated-access'));
  assert.ok(proLogout.cookie.includes('cof_refresh=rotated-refresh'));
  assert.ok(!proLogout.cookie.includes('synthetic-refresh'));
  assert.ok(!proLogout.cookie.includes('synthetic-cookie'));
  assert.ok(proLogout.cookie.includes(`cof_csrf=${'a'.repeat(43)}`));

  const clientRefresh = calls.find(
    (call) => call.url === '/api/auth/client/refresh',
  );
  assert.deepEqual(JSON.parse(clientRefresh.body), {
    refreshToken: 'synthetic-refresh',
  });
  const clientLogout = calls.find(
    (call) => call.url === '/api/auth/client/logout',
  );
  assert.equal(clientLogout.authorization, 'Bearer rotated-client-token');
  assert.deepEqual(JSON.parse(clientLogout.body), {
    refreshToken: 'rotated-client-refresh',
  });
});

test('a refresh that does not rotate fails and a denied refresh keeps the previous credentials for logout', async (t) => {
  const options = credentialsOptions(t);
  refreshMode = 'same';
  const same = await runExternalMonitor(options);
  for (const key of ['func_auth_professional_refresh', 'func_client_refresh']) {
    const check = same.checks.find((item) => item.checkKey === key);
    assert.equal(check.status, 'failed', key);
    assert.equal(check.httpStatus, 200, key);
  }

  calls.length = 0;
  refreshMode = 'denied';
  const denied = await runExternalMonitor(options);
  for (const key of ['func_auth_professional_refresh', 'func_client_refresh']) {
    const check = denied.checks.find((item) => item.checkKey === key);
    assert.equal(check.status, 'failed', key);
    assert.equal(check.httpStatus, 401, key);
  }
  const proLogout = calls.find((call) => call.url === '/api/auth/logout');
  assert.ok(proLogout.cookie.includes('cof_refresh=synthetic-refresh'));
  assert.ok(proLogout.cookie.includes('cof_access=synthetic-cookie'));
  const clientLogout = calls.find(
    (call) => call.url === '/api/auth/client/logout',
  );
  assert.equal(clientLogout.authorization, 'Bearer synthetic-client-token');
  assert.equal(JSON.parse(clientLogout.body).refreshToken, 'synthetic-refresh');
});

test('missing credentials or a failed login leave the dependent read probes not executed', async (t) => {
  const options = fixture(t);
  const keysOf = (result, keys) =>
    keys.map((key) => result.checks.find((check) => check.checkKey === key));
  const proKeys = [
    'func_subscription_query',
    'func_training_catalog_query',
    'func_training_templates_query',
    'func_auth_professional_refresh',
  ];
  const clientKeys = [
    'func_client_record_query',
    'func_client_training_plan_query',
    'func_client_training_context_query',
    'func_client_training_history_query',
    'func_client_refresh',
  ];

  const anonymous = await runExternalMonitor(options);
  for (const check of keysOf(anonymous, [...proKeys, ...clientKeys])) {
    assert.equal(check.status, 'not_executed', check.checkKey);
    assert.equal(check.errorCode, 'CREDENTIALS_NOT_CONFIGURED', check.checkKey);
    assert.equal(check.httpStatus, null);
  }
  assert.ok(!calls.some((call) => call.url.includes('/auth/')));
  assert.ok(!calls.some((call) => call.url.startsWith('/api/me/')));
  assert.ok(!calls.some((call) => call.url.startsWith('/api/training/')));

  calls.length = 0;
  const proOnly = await runExternalMonitor({
    ...options,
    proIdentifier: 'synthetic-pro@example.invalid',
    proPassword: 'synthetic-password',
  });
  for (const check of keysOf(proOnly, proKeys)) {
    assert.equal(check.status, 'passed', check.checkKey);
  }
  for (const check of keysOf(proOnly, clientKeys)) {
    assert.equal(check.status, 'not_executed', check.checkKey);
  }

  calls.length = 0;
  loginFails = true;
  const rejected = await runExternalMonitor(credentialsOptions(t));
  for (const check of keysOf(rejected, [...proKeys, ...clientKeys])) {
    assert.equal(check.status, 'not_executed', check.checkKey);
    assert.equal(check.errorCode, 'SESSION_CHECK_FAILED', check.checkKey);
  }
  assert.ok(!calls.some((call) => call.url.includes('refresh')));
  assert.ok(!calls.some((call) => call.url.startsWith('/api/training/')));
});

test('stored payloads and files never contain credentials, tokens or identities', async (t) => {
  const options = credentialsOptions(t);
  await runExternalMonitor(options);
  await runExternalMonitor({ ...options, replayOnly: true });
  const stored = [
    JSON.stringify(ingestedRuns),
    ...fs
      .readdirSync(options.outDir)
      .map((name) =>
        fs.readFileSync(path.join(options.outDir, name), 'utf8'),
      ),
  ].join('\n');
  assert.ok(stored.includes('func_client_refresh'));
  for (const sensitive of [
    options.proIdentifier,
    options.proPassword,
    options.clientIdentifier,
    options.clientPassword,
    clientId,
    accountId,
    'a'.repeat(43),
    'synthetic-cookie',
    'synthetic-refresh',
    'rotated-access',
    'rotated-refresh',
    'synthetic-client-token',
    'rotated-client-token',
    'rotated-client-refresh',
    'Bearer ',
    'secret-token',
  ]) {
    assert.ok(!stored.includes(sensitive), sensitive);
  }
});

test('a failed API probe records dependent checks as not executed without repeat requests', async (t) => {
  const options = fixture(t);
  apiDown = true;
  const result = await runExternalMonitor(options);
  // /api/ready se sondea primero: su fallo cuenta como sondeo malo para D-01.
  assert.deepEqual(
    result.checks
      .filter((check) => check.status === 'failed')
      .map((check) => check.checkKey),
    ['api_db_readiness', 'api_liveness'],
  );
  for (const key of [
    'web_proxy_readiness',
    'func_error_handling_404',
    'func_auth_unauthorized_guard',
    'func_clients_query',
    'func_plans_catalog',
    'func_client_auth_and_modules',
    'func_subscription_query',
    'func_client_refresh',
  ]) {
    const check = result.checks.find((item) => item.checkKey === key);
    assert.equal(check?.status, 'not_executed', key);
    assert.equal(check.errorCode, 'API_UNAVAILABLE', key);
  }
  assert.deepEqual(
    calls
      .filter((call) => isApiProbe(call.url))
      .map((call) => call.url),
    ['/api/ready', '/api/health'],
  );
});

test('ready failing while health passes skips only database-dependent checks', async (t) => {
  const options = {
    ...fixture(t),
    proIdentifier: 'synthetic-pro@example.invalid',
    proPassword: 'synthetic-password',
    clientIdentifier: 'synthetic-client@example.invalid',
    clientPassword: 'synthetic-client-password',
    clientId,
  };
  readyFails = true;
  const result = await runExternalMonitor(options);
  const byKey = Object.fromEntries(
    result.checks.map((check) => [check.checkKey, check]),
  );
  assert.deepEqual(
    result.checks
      .filter((check) => check.status === 'failed')
      .map((check) => check.checkKey),
    ['api_db_readiness'],
  );
  for (const key of ['api_liveness', 'web_availability']) {
    assert.equal(byKey[key].status, 'passed', key);
  }
  assert.equal(byKey.func_error_handling_404.status, 'passed');
  assert.equal(byKey.func_auth_unauthorized_guard.status, 'passed');
  const dependents = [
    'web_proxy_readiness',
    'func_plans_catalog',
    ...Object.keys(byKey).filter(
      (key) =>
        key.startsWith('func_') &&
        !['func_error_handling_404', 'func_auth_unauthorized_guard'].includes(
          key,
        ),
    ),
  ];
  for (const key of dependents) {
    assert.equal(byKey[key].status, 'not_executed', key);
    assert.equal(byKey[key].errorCode, 'DATABASE_NOT_READY', key);
  }
  const apiCalls = calls
    .filter((call) => isApiProbe(call.url))
    .map((call) => call.url);
  assert.deepEqual(apiCalls.slice(0, 2), ['/api/ready', '/api/health']);
  assert.ok(!apiCalls.some((url) => url.includes('/auth/')));
  assert.ok(!apiCalls.includes('/api/plans'));
});

test('without a configured Web target an API outage leaves the proxy check unconfigured', async (t) => {
  apiDown = true;
  const result = await runExternalMonitor({ ...fixture(t), webUrl: '' });
  const proxy = result.checks.find(
    (check) => check.checkKey === 'web_proxy_readiness',
  );
  assert.equal(proxy.errorCode, 'WEB_TARGET_NOT_CONFIGURED');
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
