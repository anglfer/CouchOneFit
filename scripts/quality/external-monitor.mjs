// Monitor sintético HTTP independiente del proceso de la API.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendJsonl, parseCliArgs, round, utcDay } from './lib/common.mjs';

const MINUTE = 60_000;
const TICK = 5 * MINUTE;
const CONFIG_REFRESH_WHEN_PAUSED = 60 * MINUTE;
const MAX_MISSED_LOOKBACK = 7 * 24 * 60 * MINUTE;
const MAX_BATCHES_PER_RUN = 100;
const DEFAULT_INTERVAL_MINUTES = 30;
const COLD_START_PATHS = ['/api/health', '/api/ready'];
const INGEST_PATH = '/api/observability/ingest';
const CONFIG_PATH = '/api/observability/monitor-config';
const SUPPORTED_INTERVALS = [5, 10, 15, 30, 60];
const ENVIRONMENTS = [
  'production',
  'staging',
  'development',
  'local',
  'ci',
  'test',
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHECKS = {
  web_availability: {
    service: 'web',
    module: 'web',
    path: '/',
    name: 'Disponibilidad de aplicación Web (Vercel)',
    expected: 'HTTP 200 y página HTML de CouchOne Fit.',
  },
  web_proxy_readiness: {
    service: 'web',
    module: 'web',
    path: '/api/health',
    name: 'Conexión Web hacia API (proxy de Vercel)',
    expected: 'HTTP 200 con JSON status=ok vía proxy Web.',
  },
  api_liveness: {
    service: 'api',
    module: 'health',
    path: '/api/health',
    name: 'Disponibilidad de proceso API (Render)',
    expected: 'HTTP 200 con status=ok y fecha de comprobación válida.',
  },
  api_db_readiness: {
    service: 'database',
    module: 'database',
    path: '/api/ready',
    name: 'Conectividad de API con PostgreSQL',
    expected: 'HTTP 200 con status=ok y database=ok desde la API.',
  },
  func_plans_catalog: {
    service: 'api',
    module: 'plans',
    path: '/api/plans',
    name: 'Catálogo público de planes SaaS',
    expected: 'HTTP 200 con un arreglo no vacío de planes válidos.',
  },
  func_error_handling_404: {
    service: 'api',
    module: 'system',
    path: '/api/observability-probe-not-found',
    name: 'Manejo seguro de un recurso inexistente',
    expected: 'HTTP 404 con error.code=NOT_FOUND y sin detalles internos.',
  },
  func_auth_unauthorized_guard: {
    service: 'api',
    module: 'auth',
    path: '/api/admin/session',
    name: 'Protección del acceso anónimo al panel',
    expected: 'HTTP 401 con error.code=SESSION_REQUIRED.',
  },
  func_auth_professional_login: {
    service: 'api',
    module: 'auth',
    path: '/api/auth/login',
    name: 'Autenticación profesional',
    expected: 'HTTP 200 con rol profesional y cookies de sesión.',
  },
  func_clients_query: {
    service: 'api',
    module: 'clients',
    path: '/api/clients',
    name: 'Consulta de cartera de clientes',
    expected:
      'HTTP 200 con la estructura de cartera paginada y el expediente sintético si está configurado.',
  },
  func_training_query: {
    service: 'api',
    module: 'training',
    path: '/api/clients/:clientId/training-plans',
    name: 'Consulta de entrenamiento',
    expected:
      'HTTP 200 con versiones y revisión activa del expediente de prueba.',
  },
  func_nutrition_query: {
    service: 'api',
    module: 'nutrition',
    path: '/api/clients/:clientId/nutrition-plans',
    name: 'Consulta de planes nutricionales',
    expected: 'HTTP 200 con versiones, revisión activa y permiso de edición.',
  },
  func_followup_query: {
    service: 'api',
    module: 'follow_up',
    path: '/api/clients/:clientId/follow-up',
    name: 'Consulta de seguimiento',
    expected:
      'HTTP 200 con el expediente de prueba, revisiones, sesiones e intervalo de seguimiento.',
  },
  func_client_login: {
    service: 'api',
    module: 'auth',
    path: '/api/auth/client/login',
    name: 'Autenticación móvil de cliente',
    expected: 'HTTP 200 con rol cliente y sesión móvil.',
  },
  func_client_auth_and_modules: {
    service: 'api',
    module: 'client',
    path: '/api/client/profile',
    name: 'Consulta de perfil móvil',
    expected: 'HTTP 200 con perfil asociado a la identidad autenticada.',
  },
  func_subscription_query: {
    service: 'api',
    module: 'subscription',
    path: '/api/me/subscription',
    name: 'Consulta de suscripción profesional (F-09)',
    expected:
      'HTTP 200 con el estado de la suscripción, el uso de cupo y la bandera de cancelación.',
  },
  func_training_catalog_query: {
    service: 'api',
    module: 'training',
    path: '/api/training/exercises',
    name: 'Catálogo de ejercicios (F-17)',
    expected:
      'HTTP 200 con una página de ejercicios, filtros y desplazamiento siguiente válidos.',
  },
  func_training_templates_query: {
    service: 'api',
    module: 'training',
    path: '/api/training/templates',
    name: 'Plantillas de entrenamiento (F-17)',
    expected:
      'HTTP 200 con el arreglo de versiones de plantillas propias (puede estar vacío).',
  },
  func_auth_professional_refresh: {
    service: 'api',
    module: 'auth',
    path: '/api/auth/refresh',
    name: 'Renovación de sesión profesional (F-04)',
    expected:
      'HTTP 200 con rol profesional y cookies de sesión rotadas (access y refresh nuevas).',
  },
  func_client_record_query: {
    service: 'api',
    module: 'client',
    path: '/api/me/record',
    name: 'Perfil base del cliente (F-21)',
    expected: 'HTTP 200 con el expediente base propio y estado válido.',
  },
  func_client_training_plan_query: {
    service: 'api',
    module: 'training',
    path: '/api/me/training-plan',
    name: 'Rutina vigente del cliente (F-22)',
    expected:
      'HTTP 200 con el contexto de entrenamiento; plan=null es el estado vacío válido sin rutina activa.',
  },
  func_client_training_context_query: {
    service: 'api',
    module: 'training',
    path: '/api/me/training-sessions/context',
    name: 'Contexto de registro de sesión del cliente (F-22)',
    expected:
      'HTTP 200 con el contexto de la fecha actual; el parámetro date es opcional y plan/session=null son válidos.',
  },
  func_client_training_history_query: {
    service: 'api',
    module: 'training',
    path: '/api/me/training-history',
    name: 'Historial de entrenamiento del cliente (F-24)',
    expected:
      'HTTP 200 con el arreglo de sesiones (puede estar vacío) y desplazamiento siguiente válido.',
  },
  func_client_refresh: {
    service: 'api',
    module: 'auth',
    path: '/api/auth/client/refresh',
    name: 'Renovación de sesión móvil (F-04)',
    expected:
      'HTTP 200 con rol cliente y un par de tokens rotado y distinto del anterior.',
  },
};
const PORTFOLIO_CHECKS = [
  'func_training_query',
  'func_nutrition_query',
  'func_followup_query',
];
const PROFESSIONAL_CHECKS = [
  'func_auth_professional_login',
  'func_clients_query',
  ...PORTFOLIO_CHECKS,
  'func_subscription_query',
  'func_training_catalog_query',
  'func_training_templates_query',
  'func_auth_professional_refresh',
];
const CLIENT_CHECKS = [
  'func_client_login',
  'func_client_auth_and_modules',
  'func_client_record_query',
  'func_client_training_plan_query',
  'func_client_training_context_query',
  'func_client_training_history_query',
  'func_client_refresh',
];
const API_CHECKS = Object.keys(CHECKS).filter(
  (key) => CHECKS[key].service !== 'web',
);

const SKIP_MESSAGES = {
  API_TARGET_NOT_CONFIGURED: 'Falta configurar la URL de la API.',
  WEB_TARGET_NOT_CONFIGURED: 'Falta configurar la URL de la Web.',
  API_UNAVAILABLE:
    'El proceso de la API no respondió según el contrato de salud.',
  WEB_UNAVAILABLE:
    'La página principal de la Web no respondió según lo esperado.',
  DATABASE_NOT_READY:
    'La comprobación directa de conexión con PostgreSQL falló.',
  CREDENTIALS_NOT_CONFIGURED:
    'Faltan las credenciales de la cuenta sintética dedicada.',
  ORIGIN_NOT_CONFIGURED:
    'Falta configurar el origen Web autorizado para el login profesional.',
  SESSION_CHECK_FAILED: 'La comprobación de sesión previa falló.',
  CLIENT_ID_NOT_CONFIGURED: 'Falta el UUID del expediente de prueba dedicado.',
  CLIENT_SCOPE_NOT_CONFIRMED:
    'La cartera de prueba no confirmó el expediente configurado.',
  SCHEDULE_SLOT_MISSED:
    'El ejecutor no registró una comprobación para el intervalo programado.',
};

function deterministicId(prefix, seed) {
  return `${prefix}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

function validateUrl(value, option, pathname) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (
      (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.replace(/\/$/, '') === pathname.replace(/\/$/, '')
    ) {
      return url;
    }
  } catch {
    // El valor de configuración puede contener credenciales y nunca se imprime.
  }
  throw new Error(
    `URL inválida en ${option}. Usa HTTPS o HTTP local y la ruta configurada sin credenciales.`,
  );
}

function httpError(error) {
  if (['TimeoutError', 'AbortError'].includes(error?.name)) {
    return { code: 'TIMEOUT', message: 'Tiempo de espera agotado.' };
  }
  const code = error?.cause?.code;
  const connectionCodes = [
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
  ];
  return {
    code: connectionCodes.includes(code) ? code : 'NETWORK_ERROR',
    message: 'No se pudo completar la conexión HTTP.',
  };
}

async function timedFetch(url, options, timeoutMs, fetchImpl) {
  const started = performance.now();
  const correlationId = options.headers?.['X-Request-Id'];
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    let json = null;
    if (/\bapplication\/json\b/i.test(contentType)) {
      try {
        json = JSON.parse(text);
      } catch {
        // El contrato fallará. No se registran respuestas crudas.
      }
    }
    return {
      response,
      text,
      json,
      contentType,
      status: response.status,
      correlationId,
      durationMs: round(performance.now() - started, 1),
      error: null,
    };
  } catch (error) {
    return {
      response: null,
      text: '',
      json: null,
      contentType: '',
      status: response?.status ?? null,
      correlationId,
      durationMs: round(performance.now() - started, 1),
      error: httpError(error),
    };
  }
}

function sessionCookies(reply) {
  const cookies = new Map();
  for (const header of reply.response?.headers.getSetCookie() ?? []) {
    const pair = header.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const name = pair.slice(0, eq);
      if (['cof_access', 'cof_refresh', 'cof_csrf'].includes(name)) {
        cookies.set(name, pair.slice(eq + 1));
      }
    }
  }
  return cookies;
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

function isDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validVersions(body, clientId) {
  return (
    Array.isArray(body?.versions) &&
    body.versions.every(
      (row) => isUuid(row?.id) && row.clientId === clientId,
    ) &&
    (body.activeVersionId === null || isUuid(body.activeVersionId)) &&
    Number.isInteger(body.activeRevision) &&
    body.activeRevision >= 0
  );
}

function nextOffsetOk(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function validTrainingContext(body) {
  return (
    isUuid(body?.clientId) &&
    isDate(body.localDate) &&
    isDate(body.today) &&
    typeof body.timeZone === 'string' &&
    typeof body.canWrite === 'boolean' &&
    Number.isInteger(body.activeRevision) &&
    (body.plan === null || isObject(body.plan)) &&
    (body.dayId === null || typeof body.dayId === 'string') &&
    (body.session === null || isObject(body.session))
  );
}

function nonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

function resultMetadata(checkKey, runId, environment, executedAt) {
  const check = CHECKS[checkKey];
  return {
    externalEventId: deterministicId('evt', `${runId}:${checkKey}`),
    correlationId: `${runId}-${checkKey}`,
    checkKey,
    checkName: check.name,
    checkKind: checkKey.startsWith('func_')
      ? 'synthetic_functional'
      : 'synthetic_availability',
    service: check.service,
    module: check.module,
    environment,
    target: check.path,
    phase: 'regular',
    executedAt: executedAt.toISOString(),
    expectedResult: check.expected,
  };
}

function skippedResult(metadata, reason) {
  return {
    ...metadata,
    actualResult: SKIP_MESSAGES[reason],
    status: 'not_executed',
    durationMs: null,
    httpStatus: null,
    errorCode: reason,
    errorMessage: SKIP_MESSAGES[reason],
    assertions: [],
  };
}

// Un proceso que arrancó dentro de la duración de la respuesta (más 1 s de
// margen) estaba en arranque en frío. Sin uptimeS (API antigua) es regular.
function probePhase(metadata, reply) {
  const uptimeS = reply.json?.uptimeS;
  return COLD_START_PATHS.includes(metadata.target) &&
    typeof uptimeS === 'number' &&
    Number.isFinite(uptimeS) &&
    uptimeS * 1000 <= reply.durationMs + 1000
    ? 'cold_start'
    : metadata.phase;
}

function observedResult(metadata, reply, expectedStatus, verify, errorCode) {
  const correctStatus = reply.status === expectedStatus;
  const correctContract = !reply.error && Boolean(verify(reply));
  const passed = correctStatus && correctContract;
  const status = passed ? 'passed' : 'failed';
  const description =
    reply.error?.message ??
    `HTTP ${reply.status}. Contrato ${correctContract ? 'válido' : 'inesperado'}.`;
  return {
    ...metadata,
    phase: probePhase(metadata, reply),
    correlationId: reply.correlationId ?? metadata.correlationId,
    actualResult: description,
    status,
    durationMs: reply.durationMs,
    httpStatus: reply.status,
    errorCode: passed ? null : (reply.error?.code ?? errorCode),
    errorMessage: passed ? null : description,
    assertions: [
      { name: 'http_status', ok: correctStatus },
      { name: 'response_contract', ok: correctContract },
    ],
  };
}

function readyContract({ json }) {
  return json?.status === 'ok' && json.database === 'ok';
}

async function runChecks({
  api,
  web,
  apiCall,
  webCall,
  initialReady,
  origin,
  credentials,
  runId,
  environment,
  now,
}) {
  const checks = new Map();
  const skip = (keys, reason) => {
    for (const key of keys) {
      checks.set(
        key,
        skippedResult(resultMetadata(key, runId, environment, now()), reason),
      );
    }
  };
  const record = (key, reply, expectedStatus, verify, errorCode) => {
    const result = observedResult(
      resultMetadata(key, runId, environment, now()),
      reply,
      expectedStatus,
      verify,
      errorCode,
    );
    checks.set(key, result);
    return result.status === 'passed';
  };

  // /api/ready es la primera petición a la API de cada corrida: si Render está
  // dormido, esta petición lo despierta y su duración cuenta para D-01 (§8.5).
  const [home, ready] = await Promise.all([
    web ? webCall('/') : null,
    initialReady ?? (api ? apiCall('/api/ready') : null),
  ]);
  const webAvailable =
    home &&
    record(
      'web_availability',
      home,
      200,
      ({ text, contentType }) =>
        /\btext\/html\b/i.test(contentType) &&
        /<title[^>]*>[^<]*CouchOne Fit/i.test(text) &&
        /\bid=["']root["']/i.test(text),
      'WEB_UNEXPECTED_RESPONSE',
    );
  if (!home) skip(['web_availability'], 'WEB_TARGET_NOT_CONFIGURED');

  if (!ready) {
    skip(API_CHECKS, 'API_TARGET_NOT_CONFIGURED');
    skip(
      ['web_proxy_readiness'],
      web ? 'API_TARGET_NOT_CONFIGURED' : 'WEB_TARGET_NOT_CONFIGURED',
    );
    return [...checks.values()];
  }

  const databaseReady = record(
    'api_db_readiness',
    ready,
    200,
    readyContract,
    'DB_READINESS_FAILED',
  );
  // Si /api/ready falla, /api/health distingue proceso caído de BD no lista.
  const health = await apiCall('/api/health');
  const apiAvailable = record(
    'api_liveness',
    health,
    200,
    ({ json }) => json?.status === 'ok' && isDate(json.timestamp),
    'API_HEALTH_FAILED',
  );
  if (!apiAvailable) {
    skip(
      API_CHECKS.filter(
        (key) => key !== 'api_liveness' && key !== 'api_db_readiness',
      ),
      'API_UNAVAILABLE',
    );
    skip(
      ['web_proxy_readiness'],
      web ? 'API_UNAVAILABLE' : 'WEB_TARGET_NOT_CONFIGURED',
    );
    return [...checks.values()];
  }

  const [notFound, guard] = await Promise.all([
    apiCall('/api/observability-probe-not-found'),
    apiCall('/api/admin/session'),
  ]);
  record(
    'func_error_handling_404',
    notFound,
    404,
    ({ json, text }) =>
      json?.error?.code === 'NOT_FOUND' &&
      !/(stack|select\s+|postgres|password)/i.test(text),
    'ERROR_CONTRACT_FAILED',
  );
  record(
    'func_auth_unauthorized_guard',
    guard,
    401,
    ({ json }) => json?.error?.code === 'SESSION_REQUIRED',
    'AUTH_GUARD_FAILED',
  );

  if (!webAvailable || !databaseReady) {
    skip(
      ['web_proxy_readiness'],
      !web
        ? 'WEB_TARGET_NOT_CONFIGURED'
        : !webAvailable
          ? 'WEB_UNAVAILABLE'
          : 'DATABASE_NOT_READY',
    );
  }
  if (!databaseReady) {
    skip(
      ['func_plans_catalog', ...PROFESSIONAL_CHECKS, ...CLIENT_CHECKS],
      'DATABASE_NOT_READY',
    );
    return [...checks.values()];
  }

  const [plans, proxy] = await Promise.all([
    apiCall('/api/plans'),
    webAvailable ? webCall('/api/health') : null,
  ]);
  if (proxy)
    record(
      'web_proxy_readiness',
      proxy,
      200,
      ({ json }) => json?.status === 'ok',
      'PROXY_READINESS_FAILED',
    );
  record(
    'func_plans_catalog',
    plans,
    200,
    ({ json }) =>
      Array.isArray(json?.plans) &&
      json.plans.length > 0 &&
      json.plans.every(
        (plan) => typeof plan?.id === 'string' && typeof plan.name === 'string',
      ),
    'PLANS_CONTRACT_FAILED',
  );

  const {
    proIdentifier,
    proPassword,
    clientIdentifier,
    clientPassword,
    clientId,
  } = credentials;
  await Promise.all([
    (async function probeProfessional() {
      if (!proIdentifier || !proPassword || !origin) {
        skip(
          PROFESSIONAL_CHECKS,
          !proIdentifier || !proPassword
            ? 'CREDENTIALS_NOT_CONFIGURED'
            : 'ORIGIN_NOT_CONFIGURED',
        );
        return;
      }
      const proHeaders = { Origin: origin };
      const csrf = await apiCall('/api/auth/csrf', { headers: proHeaders });
      const csrfToken = csrf.json?.csrfToken;
      const jar = sessionCookies(csrf);
      if (
        csrf.status !== 200 ||
        typeof csrfToken !== 'string' ||
        !/^[\w-]{43}$/.test(csrfToken) ||
        jar.get('cof_csrf') !== csrfToken
      ) {
        const loginKey = 'func_auth_professional_login';
        const metadata = resultMetadata(loginKey, runId, environment, now());
        checks.set(loginKey, {
          ...skippedResult(metadata, 'SESSION_CHECK_FAILED'),
          target: '/api/auth/csrf',
          correlationId: csrf.correlationId,
          status: 'failed',
          actualResult:
            'No se obtuvo el contexto CSRF requerido para iniciar sesión.',
          durationMs: csrf.durationMs,
          httpStatus: csrf.status,
          errorCode: csrf.error?.code ?? 'PRO_CSRF_FAILED',
          errorMessage: csrf.error?.message ?? 'Respuesta CSRF inválida.',
        });
        skip(PROFESSIONAL_CHECKS.slice(1), 'SESSION_CHECK_FAILED');
        return;
      }
      const login = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: {
          ...proHeaders,
          Cookie: cookieHeader(jar),
          'X-CSRF-Token': csrfToken,
        },
        body: { identifier: proIdentifier, password: proPassword },
      });
      for (const [name, value] of sessionCookies(login)) jar.set(name, value);
      const loggedIn = record(
        'func_auth_professional_login',
        login,
        200,
        ({ json }) =>
          json?.account?.role === 'professional' &&
          isUuid(json.account.id) &&
          Boolean(jar.get('cof_access')) &&
          Boolean(jar.get('cof_refresh')),
        'PRO_LOGIN_FAILED',
      );
      // El jar cambia al renovar la sesión: las cabeceras se leen en cada uso.
      const authHeaders = () => ({
        ...proHeaders,
        Cookie: cookieHeader(jar),
        'X-CSRF-Token': csrfToken,
      });
      async function checkPortfolio(portfolio) {
        const validClientId = isUuid(clientId);
        const clientsOk = record(
          'func_clients_query',
          portfolio,
          200,
          ({ json }) =>
            Array.isArray(json?.clients) &&
            json.clients.every((client) => isUuid(client?.id)) &&
            json.pageInfo?.pageSize === 5 &&
            typeof json.pageInfo.hasMore === 'boolean' &&
            (!validClientId ||
              json.clients.some((client) => client.id === clientId)),
          'CLIENTS_QUERY_FAILED',
        );
        if (!validClientId || !clientsOk) {
          skip(
            PORTFOLIO_CHECKS,
            !validClientId
              ? 'CLIENT_ID_NOT_CONFIGURED'
              : 'CLIENT_SCOPE_NOT_CONFIRMED',
          );
          return;
        }
        const [training, nutrition, followUp] = await Promise.all(
          PORTFOLIO_CHECKS.map((key) =>
            apiCall(CHECKS[key].path.replace(':clientId', clientId), {
              headers: authHeaders(),
            }),
          ),
        );
        record(
          'func_training_query',
          training,
          200,
          ({ json }) =>
            validVersions(json, clientId) && typeof json.timeZone === 'string',
          'TRAINING_QUERY_FAILED',
        );
        record(
          'func_nutrition_query',
          nutrition,
          200,
          ({ json }) =>
            validVersions(json, clientId) && typeof json.canWrite === 'boolean',
          'NUTRITION_QUERY_FAILED',
        );
        record(
          'func_followup_query',
          followUp,
          200,
          ({ json }) =>
            json?.clientId === clientId &&
            isDate(json.from) &&
            isDate(json.to) &&
            Array.isArray(json.checkIns) &&
            Array.isArray(json.sessions) &&
            isObject(json.adherence) &&
            isObject(json.visibility),
          'FOLLOWUP_QUERY_FAILED',
        );
      }
      try {
        if (!loggedIn) {
          skip(PROFESSIONAL_CHECKS.slice(1), 'SESSION_CHECK_FAILED');
          return;
        }
        const [portfolio, subscription, catalog, templates] = await Promise.all(
          [
            apiCall('/api/clients?pageSize=5', { headers: authHeaders() }),
            apiCall('/api/me/subscription', { headers: authHeaders() }),
            apiCall('/api/training/exercises', { headers: authHeaders() }),
            apiCall('/api/training/templates', { headers: authHeaders() }),
          ],
        );
        record(
          'func_subscription_query',
          subscription,
          200,
          ({ json }) =>
            isObject(json?.subscription) &&
            ['active', 'grace', 'suspended', 'expired', 'none'].includes(
              json.subscription.status,
            ) &&
            Number.isInteger(json.subscription.used) &&
            typeof json.subscription.cancelAtPeriodEnd === 'boolean',
          'SUBSCRIPTION_QUERY_FAILED',
        );
        record(
          'func_training_catalog_query',
          catalog,
          200,
          ({ json }) =>
            Array.isArray(json?.exercises) &&
            json.exercises.every(
              (item) =>
                nonEmptyString(item?.id) && nonEmptyString(item.name),
            ) &&
            nextOffsetOk(json.nextOffset) &&
            isObject(json.filters),
          'TRAINING_CATALOG_FAILED',
        );
        record(
          'func_training_templates_query',
          templates,
          200,
          ({ json }) =>
            Array.isArray(json?.versions) &&
            json.versions.every(
              (row) => isUuid(row?.id) && row.clientId === null,
            ) &&
            json.activeVersionId === null,
          'TRAINING_TEMPLATES_FAILED',
        );
        await checkPortfolio(portfolio);

        // La renovación rota las cookies; es la última petición antes de salir.
        const previousRefresh = jar.get('cof_refresh');
        const refreshed = await apiCall('/api/auth/refresh', {
          method: 'POST',
          headers: authHeaders(),
        });
        // Una respuesta de error borra las cookies con valor vacío: se ignoran.
        for (const [name, value] of sessionCookies(refreshed)) {
          if (value) jar.set(name, value);
        }
        record(
          'func_auth_professional_refresh',
          refreshed,
          200,
          ({ json }) =>
            json?.account?.role === 'professional' &&
            isUuid(json.account.id) &&
            Boolean(jar.get('cof_access')) &&
            Boolean(jar.get('cof_refresh')) &&
            jar.get('cof_refresh') !== previousRefresh,
          'PRO_REFRESH_FAILED',
        );
      } finally {
        if (jar.get('cof_access'))
          await apiCall('/api/auth/logout', {
            method: 'POST',
            headers: authHeaders(),
          });
      }
    })(),
    (async function probeClient() {
      if (!clientIdentifier || !clientPassword) {
        skip(CLIENT_CHECKS, 'CREDENTIALS_NOT_CONFIGURED');
        return;
      }
      const login = await apiCall('/api/auth/client/login', {
        method: 'POST',
        body: { identifier: clientIdentifier, password: clientPassword },
      });
      const account = login.json?.account;
      const session = login.json?.session;
      const tokenPair =
        typeof session?.accessToken === 'string' &&
        session.accessToken !== '' &&
        typeof session?.refreshToken === 'string' &&
        session.refreshToken !== '';
      const loggedIn = record(
        'func_client_login',
        login,
        200,
        () =>
          account?.role === 'client' &&
          isUuid(account.id) &&
          tokenPair &&
          isDate(session.expiresAt),
        'CLIENT_LOGIN_FAILED',
      );
      // El par vigente cambia al renovar: el cierre de sesión usa el último.
      const tokens = tokenPair
        ? { access: session.accessToken, refresh: session.refreshToken }
        : null;
      const bearer = () => ({ Authorization: `Bearer ${tokens.access}` });
      try {
        if (!loggedIn) {
          skip(CLIENT_CHECKS.slice(1), 'SESSION_CHECK_FAILED');
          return;
        }
        const [profile, baseRecord, plan, context, history] = await Promise.all([
          apiCall('/api/client/profile', { headers: bearer() }),
          apiCall('/api/me/record', { headers: bearer() }),
          apiCall('/api/me/training-plan', { headers: bearer() }),
          apiCall('/api/me/training-sessions/context', { headers: bearer() }),
          apiCall('/api/me/training-history', { headers: bearer() }),
        ]);
        record(
          'func_client_auth_and_modules',
          profile,
          200,
          ({ json }) =>
            isUuid(json?.profile?.id) &&
            json.profile.userId === account.id &&
            ['active', 'inactive'].includes(json.profile.status),
          'CLIENT_PROFILE_FAILED',
        );
        record(
          'func_client_record_query',
          baseRecord,
          200,
          ({ json }) =>
            isObject(json?.record) &&
            isUuid(json.record.id) &&
            typeof json.record.fullName === 'string' &&
            ['active', 'inactive'].includes(json.record.status),
          'CLIENT_RECORD_FAILED',
        );
        record(
          'func_client_training_plan_query',
          plan,
          200,
          ({ json }) => validTrainingContext(json),
          'CLIENT_TRAINING_PLAN_FAILED',
        );
        record(
          'func_client_training_context_query',
          context,
          200,
          ({ json }) => validTrainingContext(json),
          'CLIENT_TRAINING_CONTEXT_FAILED',
        );
        record(
          'func_client_training_history_query',
          history,
          200,
          ({ json }) =>
            Array.isArray(json?.sessions) &&
            json.sessions.every(
              (item) =>
                isDate(item?.localDate) && Array.isArray(item.exercises),
            ) &&
            nextOffsetOk(json.nextOffset),
          'CLIENT_TRAINING_HISTORY_FAILED',
        );

        // La renovación rota ambos tokens; es la última petición antes de salir.
        const refreshed = await apiCall('/api/auth/client/refresh', {
          method: 'POST',
          body: { refreshToken: tokens.refresh },
        });
        const next = refreshed.json?.session;
        const rotated =
          nonEmptyString(next?.accessToken) &&
          nonEmptyString(next?.refreshToken) &&
          next.accessToken !== tokens.access &&
          next.refreshToken !== tokens.refresh;
        record(
          'func_client_refresh',
          refreshed,
          200,
          ({ json }) =>
            json?.account?.role === 'client' &&
            json.account.id === account.id &&
            rotated &&
            isDate(next.expiresAt),
          'CLIENT_REFRESH_FAILED',
        );
        if (
          refreshed.status === 200 &&
          nonEmptyString(next?.accessToken) &&
          nonEmptyString(next?.refreshToken)
        ) {
          tokens.access = next.accessToken;
          tokens.refresh = next.refreshToken;
        }
      } finally {
        if (tokens) {
          await apiCall('/api/auth/client/logout', {
            method: 'POST',
            headers: bearer(),
            body: { refreshToken: tokens.refresh },
          });
        }
      }
    })(),
  ]);
  return [...checks.values()];
}

function readState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

function replaceFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

function readPendingQueue(file) {
  if (!fs.existsSync(file)) return [];
  const queue = new Map();
  for (const line of fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      throw new Error(
        'La cola de ingesta contiene una línea JSON inválida. Conserva el archivo para recuperar los lotes válidos.',
      );
    }
    const key = entry?.run?.externalRunId;
    if (typeof key !== 'string' || !Array.isArray(entry.checks)) {
      throw new Error(
        'La cola de ingesta contiene un lote sin identificador o comprobaciones.',
      );
    }
    if (!queue.has(key)) queue.set(key, entry);
  }
  return [...queue.values()];
}

async function syncPending({
  queueFile,
  ingestUrl,
  ingestToken,
  timeoutMs,
  fetchImpl,
  outDir,
  environment,
}) {
  const queue = readPendingQueue(queueFile);
  if (!ingestUrl || !ingestToken || !queue.length) {
    return { synced: 0, rejected: 0, pendingSync: queue.length };
  }
  const remaining = [];
  let synced = 0;
  let rejected = 0;
  let paused = false;
  for (const item of queue) {
    if (
      paused ||
      synced + rejected >= MAX_BATCHES_PER_RUN ||
      item.run.environment !== environment
    ) {
      remaining.push(item);
      continue;
    }
    const response = await timedFetch(
      ingestUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Observability-Token': ingestToken,
        },
        body: JSON.stringify(item),
      },
      Math.min(timeoutMs, 20_000),
      fetchImpl,
    );
    if (
      [200, 201].includes(response.status) &&
      typeof response.json?.runId === 'string'
    ) {
      synced += 1;
    } else if ([400, 413, 422].includes(response.status)) {
      appendJsonl(path.join(outDir, 'rejected-ingest.jsonl'), item);
      rejected += 1;
    } else {
      remaining.push(item);
      paused = true;
    }
  }
  replaceFile(
    queueFile,
    remaining.map((item) => `${JSON.stringify(item)}\n`).join(''),
  );
  return { synced, rejected, pendingSync: remaining.length };
}

async function scheduledSlot({ file, tick, fetchConfig, monitorKey }) {
  const previous = readState(file);
  const cached =
    previous?.monitorKey === monitorKey &&
    typeof previous.enabled === 'boolean' &&
    SUPPORTED_INTERVALS.includes(previous.interval)
      ? previous
      : null;
  const interval = cached?.interval ?? DEFAULT_INTERVAL_MINUTES;
  const enabled = cached?.enabled ?? true;
  const lastSlot = Number.isInteger(cached?.lastSlot) ? cached.lastSlot : null;
  if (!enabled && tick - cached.lastConfigCheck < CONFIG_REFRESH_WHEN_PAUSED) {
    return { reason: 'monitor_disabled' };
  }
  if (enabled && lastSlot !== null && tick - lastSlot < interval * MINUTE) {
    return { reason: 'interval_not_elapsed' };
  }

  const fresh = await fetchConfig();
  const settings = {
    monitorKey,
    enabled: fresh?.monitorEnabled ?? enabled,
    interval: fresh?.checkIntervalMinutes ?? interval,
    lastConfigCheck: tick,
    lastSlot,
  };
  if (!settings.enabled) {
    replaceFile(file, `${JSON.stringify({ ...settings, lastSlot: null })}\n`);
    return { reason: 'monitor_disabled' };
  }

  const intervalMs = settings.interval * MINUTE;
  const keepsCadence =
    enabled && lastSlot !== null && interval === settings.interval;
  const slot = keepsCadence
    ? lastSlot + Math.floor((tick - lastSlot) / intervalMs) * intervalMs
    : tick;
  const missed = [];
  if (keepsCadence) {
    const lookback = Math.floor(MAX_MISSED_LOOKBACK / intervalMs) * intervalMs;
    for (
      let time = Math.max(lastSlot + intervalMs, slot - lookback);
      time < slot;
      time += intervalMs
    ) {
      missed.push(time);
    }
  }
  return { slot, missed, state: { ...settings, lastSlot: slot } };
}

function buildPayload({
  externalRunId,
  checks,
  startedAt,
  finishedAt,
  durationMs,
  environment,
  triggerSource,
  commitSha,
  missed,
}) {
  const passedChecks = checks.filter((c) => c.status === 'passed').length;
  const failedChecks = checks.filter((c) => c.status === 'failed').length;
  const notExecutedChecks = checks.length - passedChecks - failedChecks;
  let status = 'not_executed';
  if (passedChecks)
    status = failedChecks || notExecutedChecks ? 'partial' : 'passed';
  else if (failedChecks) status = 'failed';
  return {
    run: {
      externalRunId,
      category: 'synthetic_periodic',
      environment,
      triggerSource,
      status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      notExecutedChecks,
      skippedChecks: 0,
      commitSha: /^[0-9a-f]{7,40}$/i.test(commitSha ?? '') ? commitSha : null,
      notes: missed
        ? 'Intervalo programado sin ejecución registrada.'
        : 'Monitor sintético externo.',
    },
    checks,
  };
}

function storePayload({ payload, queueFile, outDir, api, web }) {
  appendJsonl(queueFile, payload);
  appendJsonl(
    path.join(
      outDir,
      `monitor-${utcDay(new Date(payload.run.startedAt))}.jsonl`,
    ),
    payload,
  );
  for (const item of payload.checks) {
    if (
      item.checkKind !== 'synthetic_availability' ||
      item.status === 'not_executed'
    )
      continue;
    const origin = item.service === 'web' ? web?.origin : api?.origin;
    appendJsonl(
      path.join(outDir, `synthetic-${utcDay(new Date(item.executedAt))}.jsonl`),
      {
        ts: item.executedAt,
        event: 'synthetic.probe',
        target: `${origin ?? ''}${item.target}`,
        ok: item.status === 'passed',
        status: item.httpStatus,
        durationMs: item.durationMs,
        phase: item.phase,
        error: item.errorMessage,
      },
    );
  }
}

export async function runExternalMonitor({
  apiUrl = '',
  webUrl = '',
  environment = 'production',
  outDir = 'logs/synthetic',
  timeoutMs = 65_000,
  ingestUrl: configuredIngestUrl = '',
  ingestToken = '',
  triggerSource = 'external_cli',
  respectSchedule = false,
  force = false,
  replayOnly = false,
  proIdentifier = '',
  proPassword = '',
  clientIdentifier = '',
  clientPassword = '',
  clientId = '',
  origin = '',
  commitSha = null,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (!ENVIRONMENTS.includes(environment))
    throw new Error('Ambiente de observabilidad inválido.');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new Error('El timeout debe estar entre 1 y 120 000 ms.');
  }
  const api = validateUrl(apiUrl, 'SYNTHETIC_API_URL', '/');
  const web = validateUrl(webUrl, 'SYNTHETIC_WEB_URL', '/');
  const allowedOrigin =
    validateUrl(origin, 'SYNTHETIC_ORIGIN', '/')?.origin ?? web?.origin;
  const ingestUrl =
    validateUrl(configuredIngestUrl, 'OBSERVABILITY_INGEST_URL', INGEST_PATH) ??
    (api ? new URL(INGEST_PATH, api) : null);
  const queueFile = path.join(outDir, 'pending-ingest.jsonl');
  const sync = () =>
    syncPending({
      queueFile,
      ingestUrl,
      ingestToken,
      timeoutMs,
      fetchImpl,
      outDir,
      environment,
    });
  if (replayOnly) return sync();

  const requestMarker =
    ingestToken && ingestUrl?.origin === api?.origin
      ? { 'X-Observability-Token': ingestToken }
      : {};
  const apiCall = (route, { method = 'GET', headers = {}, body } = {}) =>
    timedFetch(
      new URL(route, api),
      {
        method,
        headers: {
          ...requestMarker,
          ...headers,
          'X-Request-Id': crypto.randomUUID(),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      timeoutMs,
      fetchImpl,
    );
  const webCall = (route) =>
    timedFetch(new URL(route, web), { method: 'GET' }, timeoutMs, fetchImpl);
  const monitorKey = deterministicId(
    'target',
    `${environment}:${api?.origin ?? ''}:${web?.origin ?? ''}`,
  );
  const scheduleFile = path.join(outDir, `schedule-${environment}.json`);
  const started = now();
  let schedule;
  let initialReady;
  if (respectSchedule && !force) {
    schedule = await scheduledSlot({
      file: scheduleFile,
      tick: Math.floor(started.getTime() / TICK) * TICK,
      monitorKey,
      async fetchConfig() {
        if (!ingestUrl || !ingestToken) return null;
        // La sonda y la consulta de configuración comparten el arranque de la API.
        // Con el monitor pausado, solamente se consulta la configuración.
        const prior = readState(scheduleFile);
        // /api/ready debe ser la primera petición a la API de la corrida.
        if (api && prior?.enabled !== false)
          initialReady = apiCall('/api/ready');
        const reply = await timedFetch(
          new URL(CONFIG_PATH, ingestUrl),
          {
            method: 'GET',
            headers: { 'X-Observability-Token': ingestToken },
          },
          timeoutMs,
          fetchImpl,
        );
        const settings = reply.json?.settings;
        return reply.status === 200 &&
          typeof settings?.monitorEnabled === 'boolean' &&
          SUPPORTED_INTERVALS.includes(settings.checkIntervalMinutes)
          ? settings
          : null;
      },
    });
    if (schedule.reason) {
      await initialReady;
      return {
        skipped: true,
        reason: schedule.reason,
        synced: 0,
        rejected: 0,
        pendingSync: readPendingQueue(queueFile).length,
      };
    }
  }

  const slotId = (slot) => deterministicId('ext-slot', `${monitorKey}:${slot}`);
  const externalRunId = schedule
    ? slotId(schedule.slot)
    : `ext-${crypto.randomUUID()}`;
  const payloadContext = { environment, triggerSource, commitSha };
  const store = (payload) =>
    storePayload({ payload, queueFile, outDir, api, web });
  for (const slot of schedule?.missed ?? []) {
    const date = new Date(slot);
    const runId = slotId(slot);
    const checks = Object.keys(CHECKS).map((key) =>
      skippedResult(
        resultMetadata(key, runId, environment, date),
        'SCHEDULE_SLOT_MISSED',
      ),
    );
    store(
      buildPayload({
        ...payloadContext,
        externalRunId: runId,
        checks,
        startedAt: date,
        finishedAt: date,
        durationMs: 0,
        missed: true,
      }),
    );
  }

  const checks = await runChecks({
    api,
    web,
    apiCall,
    webCall,
    initialReady,
    origin: allowedOrigin,
    credentials: {
      proIdentifier,
      proPassword,
      clientIdentifier,
      clientPassword,
      clientId,
    },
    runId: externalRunId,
    environment,
    now,
  });
  const finished = now();
  const payload = buildPayload({
    ...payloadContext,
    externalRunId,
    checks,
    startedAt: schedule ? new Date(schedule.slot) : started,
    finishedAt: finished,
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    missed: false,
  });
  store(payload);
  replaceFile(
    path.join(outDir, 'latest-run.json'),
    `${JSON.stringify(payload)}\n`,
  );
  if (schedule)
    replaceFile(scheduleFile, `${JSON.stringify(schedule.state)}\n`);

  return {
    skipped: false,
    externalRunId,
    status: payload.run.status,
    passedChecks: payload.run.passedChecks,
    failedChecks: payload.run.failedChecks,
    notExecutedChecks: payload.run.notExecutedChecks,
    checks,
    ...(await sync()),
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2), {
    flags: ['respect-schedule', 'force', 'replay-only'],
  });
  const result = await runExternalMonitor({
    apiUrl: options['api-url'] ?? process.env.SYNTHETIC_API_URL ?? '',
    webUrl: options['web-url'] ?? process.env.SYNTHETIC_WEB_URL ?? '',
    environment: options.env ?? process.env.OBSERVABILITY_ENV ?? 'production',
    outDir: options.out ?? 'logs/synthetic',
    timeoutMs: Number(options.timeout ?? 65_000),
    ingestUrl:
      options['ingest-url'] ?? process.env.OBSERVABILITY_INGEST_URL ?? '',
    ingestToken:
      options['ingest-token'] ?? process.env.OBSERVABILITY_INGEST_TOKEN ?? '',
    triggerSource:
      options['trigger-source'] ??
      (process.env.GITHUB_ACTIONS ? 'github_actions' : 'external_cli'),
    respectSchedule: Boolean(options['respect-schedule']),
    force: Boolean(options.force),
    replayOnly: Boolean(options['replay-only']),
    proIdentifier: process.env.SYNTHETIC_PRO_IDENTIFIER ?? '',
    proPassword: process.env.SYNTHETIC_PRO_PASSWORD ?? '',
    clientIdentifier: process.env.SYNTHETIC_CLIENT_IDENTIFIER ?? '',
    clientPassword: process.env.SYNTHETIC_CLIENT_PASSWORD ?? '',
    clientId: process.env.SYNTHETIC_CLIENT_ID ?? '',
    origin: process.env.SYNTHETIC_ORIGIN ?? '',
    commitSha: process.env.GITHUB_SHA?.slice(0, 12) ?? null,
  });

  if (result.skipped) {
    console.log(`Monitor omitido (${result.reason}).`);
  } else if (result.externalRunId) {
    console.log(
      `Monitor ${result.externalRunId}: ${result.status} (aprobadas=${result.passedChecks}, fallidas=${result.failedChecks}, no_ejecutadas=${result.notExecutedChecks}).`,
    );
  }
  console.log(
    `Ingesta: sincronizadas=${result.synced}, pendientes=${result.pendingSync}, rechazadas=${result.rejected}.`,
  );
  if (
    result.failedChecks > 0 ||
    result.rejected > 0 ||
    (!result.skipped && result.pendingSync > 0)
  ) {
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
