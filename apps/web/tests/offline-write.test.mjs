import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// DEC-018 fase 2: bandeja de salida, sincronización, conflictos y duplicados.
let vite, dom;
let cache, store, outbox, sync, writes, leave, confirm, session, connection;
let calls, handler, realNow, training;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const apiError = (status, code, message = code) =>
  json({ error: { code, message } }, status);
const spec = (overrides = {}) => ({
  kind: 'client.create',
  method: 'POST',
  endpoint: '/api/clients',
  body: { fullName: 'Ana Torres', birthDate: '1990-05-20' },
  label: 'Crear expediente de Ana Torres',
  clientId: null,
  clientName: 'Ana Torres',
  ...overrides,
});
const editSpec = (overrides = {}) =>
  spec({
    kind: 'client.edit',
    method: 'PATCH',
    endpoint: '/api/clients/c1',
    body: { goal: 'Fuerza', version: 1 },
    label: 'Editar datos de Ana Torres',
    clientId: 'c1',
    ...overrides,
  });
const idOf = (call) => new Headers(call.headers).get('Idempotency-Key');
const writesMade = () =>
  calls.filter(
    (call) =>
      ['POST', 'PATCH'].includes(call.method) && call.url !== '/api/auth/csrf'
  );

before(async () => {
  dom = new JSDOM('', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  }
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const load = (path) => vite.ssrLoadModule(path);
  cache = await load('/src/services/offline/readCache.ts');
  store = await load('/src/services/offline/store.ts');
  outbox = await load('/src/services/offline/outbox.ts');
  sync = await load('/src/services/offline/sync.ts');
  writes = await load('/src/services/offline/writes.ts');
  leave = await load('/src/services/offline/leave.ts');
  confirm = await load('/src/services/confirm.ts');
  session = await load('/src/features/auth/services/session.ts');
  connection = await load('/src/services/offline/connection.ts');
  training = await load('/src/features/training/services/training.ts');
  realNow = Date.now;
});
after(async () => {
  Date.now = realNow;
  await vite?.close();
  dom?.window.close();
});

beforeEach(async () => {
  Date.now = realNow;
  calls = [];
  handler = () => json({ client: { id: 'new-id' } }, 201);
  store.setOfflineStore(store.createMemoryStore());
  await cache.clearOfflineData(true);
  outbox.resetOutboxForTests();
  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
    });
    if (url === '/api/auth/csrf') return json({ csrfToken: 'c'.repeat(43) });
    return handler(url, options);
  };
  await cache.noteAccount('pro-a');
  await outbox.loadOutbox('pro-a');
});

test('en línea: se envía con Idempotency-Key y no queda nada pendiente', async () => {
  let sent;
  const outcome = await writes.submitWrite(spec(), async (headers) => {
    sent = headers;
    return { client: { id: 'ok' } };
  });
  assert.equal(outcome.status, 'done');
  assert.match(sent['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.equal(outbox.getOperations().length, 0);
});

test('sin conexión: queda guardado con LA MISMA clave que se intentó y cifrado', async () => {
  let attemptedKey;
  const outcome = await writes.submitWrite(spec(), async (headers) => {
    attemptedKey = headers['Idempotency-Key'];
    throw new TypeError('Failed to fetch');
  });
  assert.equal(outcome.status, 'queued');
  assert.equal(outcome.operation.id, attemptedKey);
  assert.equal(outbox.getOperations().length, 1);
  const keys = await store.getStore().keys('outbox');
  assert.equal(keys.length, 1);
  const raw = await store.getStore().get('outbox', keys[0]);
  assert.ok(
    !Buffer.from(raw.payload.data).toString('latin1').includes('Ana Torres')
  );
});

test('HU-021 offline queues a client-bound evaluation and syncs once with its original idempotency key', async () => {
  const id = crypto.randomUUID();
  const pending = await outbox.enqueue({
    id,
    kind: 'evaluation.create',
    method: 'POST',
    endpoint: '/api/clients/client-1/evaluations',
    body: { thighSkinfoldMm: 18.2 },
    label: 'Registrar evaluación de Ana Torres',
    clientId: 'client-1',
    clientName: 'Ana Torres',
  });
  assert.equal(pending.kind, 'evaluation.create');
  assert.equal(pending.clientId, 'client-1');
  handler = () =>
    json({ evaluation: { id: 'evaluation-1', clientId: 'client-1' } }, 201);
  await sync.flushOutbox();
  const sent = writesMade();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, '/api/clients/client-1/evaluations');
  assert.equal(idOf(sent[0]), id);
  assert.deepEqual(JSON.parse(sent[0].body), { thighSkinfoldMm: 18.2 });
  assert.equal(outbox.getOperations().length, 0);
});

test('un rechazo del servidor no se encola; un 503 sí', async () => {
  const ApiError = (await vite.ssrLoadModule('/src/services/api.ts')).ApiError;
  await assert.rejects(
    writes.submitWrite(spec(), async () => {
      throw new ApiError(400, 'INVALID_INPUT', 'mal');
    }),
    (error) => error.status === 400
  );
  assert.equal(outbox.getOperations().length, 0);
  const outcome = await writes.submitWrite(spec(), async () => {
    throw new ApiError(503, 'DOWN', 'caído');
  });
  assert.equal(outcome.status, 'queued');
});

test('sin almacén local se conserva el comportamiento anterior (error de red)', async () => {
  store.setOfflineStore(null);
  await assert.rejects(
    writes.submitWrite(spec(), async () => {
      throw new TypeError('Failed to fetch');
    }),
    TypeError
  );
});

test('sincroniza en orden, con la clave de cada cambio, y avisa a las pantallas', async () => {
  handler = (url) =>
    url === '/api/clients?search=Ana+Torres&status=&pageSize=20'
      ? json({ clients: [] })
      : json({ client: { id: 'ok' } });
  const a = await outbox.enqueue({ ...spec(), id: crypto.randomUUID() });
  const b = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  let notified = 0;
  const off = sync.onSynced(() => notified++);
  await sync.flushOutbox();
  off();
  const made = writesMade();
  assert.deepEqual(
    made.map((call) => call.method),
    ['POST', 'PATCH']
  );
  assert.deepEqual(made.map(idOf), [a.id, b.id]);
  assert.equal(outbox.getOperations().length, 0);
  assert.equal(notified, 1);
});

test('si se cae la red a la mitad: se detiene y no se pierde nada', async () => {
  const first = await outbox.enqueue({
    ...editSpec(),
    id: crypto.randomUUID(),
  });
  const second = await outbox.enqueue({
    ...editSpec({ endpoint: '/api/clients/c2', clientId: 'c2' }),
    id: crypto.randomUUID(),
  });
  handler = () => {
    throw new TypeError('Failed to fetch');
  };
  await sync.flushOutbox();
  assert.deepEqual(
    outbox.getOperations().map((op) => [op.id, op.state]),
    [
      [first.id, 'pending'],
      [second.id, 'pending'],
    ]
  );
  assert.equal(writesMade().length, 1, 'no insiste con el resto');
  assert.match(outbox.getOperations()[0].error, /Failed to fetch/);
});

test('conflicto de versión: queda a decisión; «aplicar el mío» usa la versión nueva', async () => {
  const op = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  handler = (url, options) => {
    if (url === '/api/clients/c1' && options.method === 'PATCH') {
      const version = JSON.parse(options.body).version;
      return version === 1
        ? apiError(409, 'CLIENT_RECORD_CONFLICT', 'El expediente cambió.')
        : json({ client: { id: 'c1', version: 4 } });
    }
    if (url === '/api/clients/c1')
      return json({ client: { id: 'c1', version: 3, goal: 'Otro' } });
    return json({});
  };
  await sync.flushOutbox();
  let current = outbox.getOperations()[0];
  assert.equal(current.state, 'conflict');
  assert.equal(current.server.version, 3);
  await sync.reapplyOnServerVersion(op.id);
  assert.equal(outbox.getOperations().length, 0);
  const patches = writesMade();
  assert.equal(JSON.parse(patches.at(-1).body).version, 3);
  assert.equal(idOf(patches.at(-1)), op.id, 'conserva la misma clave');
});

test('conflicto: «conservar el del servidor» descarta el cambio local', async () => {
  const op = await outbox.enqueue({
    ...editSpec(),
    id: crypto.randomUUID(),
  });
  handler = (url, options) =>
    url === '/api/clients/c1' && !options.method
      ? json({ client: { version: 3 } })
      : apiError(409, 'CLIENT_RECORD_CONFLICT');
  await sync.flushOutbox();
  assert.equal(outbox.getOperations()[0].state, 'conflict');
  await sync.keepServerVersion(op.id);
  assert.equal(outbox.getOperations().length, 0);
});

test('posible duplicado: mismo nombre (sin acentos ni mayúsculas) pide decisión', async () => {
  const body = { fullName: 'Ána TORRES', birthDate: '1990-05-20' };
  const op = await outbox.enqueue({
    ...spec({ body, clientName: 'Ána TORRES' }),
    id: crypto.randomUUID(),
  });
  handler = (url) =>
    url.startsWith('/api/clients?')
      ? json({
          clients: [
            { id: 'x1', fullName: 'Ana Torres' },
            { id: 'x2', fullName: 'Otra Persona' },
          ],
        })
      : json({ client: { id: 'created' } }, 201);
  await sync.flushOutbox();
  const flagged = outbox.getOperations()[0];
  assert.equal(flagged.state, 'duplicate');
  assert.deepEqual(flagged.matches, [{ id: 'x1', fullName: 'Ana Torres' }]);
  assert.equal(writesMade().length, 0, 'no se escribió nada');
  await sync.confirmNotDuplicate(op.id);
  assert.equal(writesMade().length, 1);
  assert.equal(outbox.getOperations().length, 0);
});

test('posible duplicado: «es la misma persona» descarta el pendiente sin escribir', async () => {
  const op = await outbox.enqueue({ ...spec(), id: crypto.randomUUID() });
  handler = (url) =>
    url.startsWith('/api/clients?')
      ? json({ clients: [{ id: 'x1', fullName: 'Ana Torres' }] })
      : json({}, 201);
  await sync.flushOutbox();
  await sync.dismissDuplicate(op.id);
  assert.equal(outbox.getOperations().length, 0);
  assert.equal(writesMade().length, 0);
});

test('cupo agotado u otro rechazo: queda «fallido» con el mensaje y se puede reintentar', async () => {
  const op = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  handler = () => apiError(409, 'CUPO_AGOTADO', 'Has alcanzado el límite.');
  await sync.flushOutbox();
  const failed = outbox.getOperations()[0];
  assert.equal(failed.state, 'failed');
  assert.match(failed.error, /límite/);
  handler = () => json({ client: { id: 'c1' } });
  await sync.retryOperation(op.id);
  assert.equal(outbox.getOperations().length, 0);
});

test('sesión vencida o servidor caído: se conserva y se reintenta después', async () => {
  await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  handler = (url) =>
    url === '/api/auth/refresh'
      ? apiError(401, 'SESSION_INVALID')
      : apiError(500, 'BOOM');
  await sync.flushOutbox();
  assert.equal(outbox.getOperations()[0].state, 'pending');
  assert.match(outbox.getOperations()[0].error, /500/, 'dice por qué no salió');
  assert.equal(typeof connection.isConnectionFailure, 'function');
});

test('la bandeja es por cuenta; cerrar sesión la conserva y se descarta solo a propósito', async () => {
  const mine = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  await cache.noteAccount('pro-b');
  await outbox.loadOutbox('pro-b');
  assert.equal(
    outbox.getOperations().length,
    0,
    'otra cuenta no ve los pendientes ajenos'
  );
  await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  await session.clearSessionState(false);
  assert.equal(
    (await store.getStore().keys('outbox')).length,
    2,
    'nada se borra en silencio'
  );
  await cache.noteAccount('pro-a');
  await outbox.loadOutbox('pro-a');
  assert.deepEqual(
    outbox.getOperations().map((op) => op.id),
    [mine.id]
  );
  await outbox.discardAllOperations();
  assert.equal(outbox.getOperations().length, 0);
  assert.equal(
    (await store.getStore().keys('outbox')).length,
    1,
    'solo se borró lo de esta cuenta'
  );
});

test('cerrar sesión con pendientes: pide confirmar y solo entonces descarta', async () => {
  await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  handler = () => {
    throw new TypeError('Failed to fetch');
  };
  confirm.setConfirmHandler(async () => false);
  assert.equal(await leave.confirmLeaveWithPending(), false);
  assert.equal(outbox.getOperations().length, 1);
  let message = '';
  confirm.setConfirmHandler(async (request) => {
    message = request.message;
    return true;
  });
  assert.equal(await leave.confirmLeaveWithPending(), true);
  confirm.setConfirmHandler(null);
  assert.match(message, /1 cambio sin enviar/);
  assert.equal(outbox.getOperations().length, 0);
});

test('lo pendiente caduca a los 30 días', async () => {
  const op = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
  Date.now = () => realNow() + cache.MAX_AGE_MS + 1000;
  outbox.resetOutboxForTests();
  await outbox.loadOutbox('pro-a');
  assert.equal(outbox.getOperations().length, 0);
  assert.equal(
    (await store.getStore().keys('outbox')).length,
    0,
    op.id && 'se eliminó del almacén'
  );
});

test('training: merge unsent draft, then sync create, edit and activation in dependency order', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  const draft = {
    kind: 'training.save',
    method: 'POST',
    endpoint: '/api/training/templates',
    body: {
      id: 'plan',
      versionId: 'version',
      prescription: { name: 'Original' },
    },
    label: 'Plantilla',
    clientId: null,
    clientName: null,
    entityKey: 'plan',
    readEndpoint: '/api/training/templates',
  };
  await training.trainingWrite(draft);
  await training.trainingWrite({
    ...draft,
    method: 'PATCH',
    endpoint: '/api/training/templates/plan/versions/version',
    body: { revision: 1, prescription: { name: 'Actualizada' } },
  });
  assert.equal(outbox.getOperations().length, 1);
  assert.equal(outbox.getOperations()[0].body.prescription.name, 'Actualizada');
  const create = outbox.getOperations()[0];
  await outbox.updateOperation(create.id, { attempts: 1 });
  await training.trainingWrite({
    ...draft,
    method: 'PATCH',
    endpoint: '/api/training/templates/plan/versions/version',
    body: { revision: 1, prescription: { name: 'Después' } },
  });
  await training.trainingWrite({
    ...draft,
    kind: 'training.activate',
    endpoint: '/api/clients/c1/training-plans/plan/versions/version/activate',
    body: { revision: 2, activeRevision: 0 },
  });
  assert.equal(outbox.getOperations().length, 3);
  let revision = 0;
  handler = () => json({ version: { revision: ++revision } });
  globalThis.navigator.onLine = true;
  await sync.flushOutbox();
  assert.equal(outbox.getOperations().length, 0);
  const sent = writesMade();
  assert.equal(sent.length, 3);
  assert.equal(JSON.parse(sent[1].body).revision, 1);
  assert.equal(JSON.parse(sent[2].body).revision, 2);
});

test('training: lost response preserves key, conflicts block activation and account switch isolates drafts', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  handler = () => {
    throw new TypeError('Failed to fetch');
  };
  const draft = {
    kind: 'training.save',
    method: 'PATCH',
    endpoint: '/api/clients/c1/training-plans/p1/versions/v1',
    body: { revision: 1, prescription: { name: 'Captura local' } },
    label: 'Borrador',
    clientId: 'c1',
    clientName: 'Ana',
    entityKey: 'p1',
    readEndpoint: '/api/clients/c1/training-plans',
  };
  await training.trainingWrite(draft);
  const key = idOf(writesMade()[0]);
  assert.equal(outbox.getOperations()[0].id, key);
  globalThis.navigator.onLine = false;
  await training.trainingWrite({
    ...draft,
    kind: 'training.activate',
    method: 'POST',
    endpoint: draft.endpoint + '/activate',
    body: { revision: 2, activeRevision: 0 },
  });
  handler = (url, options) =>
    options.method === 'PATCH'
      ? apiError(409, 'TRAINING_CONFLICT')
      : json({
          versions: [
            { id: 'v1', revision: 4, published: false, name: 'Servidor' },
          ],
          activeRevision: 1,
        });
  globalThis.navigator.onLine = true;
  await sync.flushOutbox();
  assert.equal(outbox.getOperations()[0].state, 'conflict');
  assert.equal(outbox.getOperations()[1].state, 'pending');
  assert.equal(
    writesMade().filter((c) => c.url.endsWith('/activate')).length,
    0
  );
  await cache.noteAccount('pro-b');
  await outbox.loadOutbox('pro-b');
  assert.equal(outbox.getOperations().length, 0);
});

test('training: discarding a change takes its dependents along (after confirming) and blocked routines refuse new writes', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  const save = {
    kind: 'training.save',
    method: 'POST',
    endpoint: '/api/clients/c1/training-plans',
    body: { id: 'p1', versionId: 'v1', prescription: { name: 'Nueva rutina' } },
    label: 'Guardar rutina: Nueva rutina',
    clientId: 'c1',
    clientName: 'Ana',
    entityKey: 'p1',
    readEndpoint: '/api/clients/c1/training-plans',
  };
  await training.trainingWrite(save);
  await training.trainingWrite({
    ...save,
    kind: 'training.activate',
    endpoint: '/api/clients/c1/training-plans/p1/versions/v1/activate',
    body: { revision: 1, activeRevision: 0 },
  });
  const [created, activation] = outbox.getOperations();
  assert.deepEqual(activation.dependsOn, [created.id]);
  await outbox.updateOperation(created.id, { state: 'failed', error: 'x' });
  await assert.rejects(training.trainingWrite(save), /Pendientes de enviar/);
  assert.equal(outbox.getOperations().length, 2, 'no new doomed item');
  confirm.setConfirmHandler(async () => false);
  await sync.discardOperation(created.id);
  assert.equal(outbox.getOperations().length, 2, 'declining keeps everything');
  confirm.setConfirmHandler(async () => true);
  await sync.discardOperation(created.id);
  confirm.setConfirmHandler(null);
  assert.equal(outbox.getOperations().length, 0);
});

test('un cambio encolado mientras ya se está sincronizando se envía en esa misma pasada', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  let late;
  handler = async (url) => {
    if (url.startsWith('/api/clients?')) return json({ clients: [] });
    if (!late) {
      late = await outbox.enqueue({ ...editSpec(), id: crypto.randomUUID() });
      void sync.flushOutbox();
    }
    return json({ client: { id: 'ok' } });
  };
  await outbox.enqueue({ ...spec(), id: crypto.randomUUID() });
  await sync.flushOutbox();
  assert.equal(writesMade().length, 2, 'no espera al siguiente ciclo de 30 s');
  assert.equal(outbox.getOperations().length, 0);
});

test('training: una acción igual ya pendiente no se encola dos veces', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  const activate = {
    kind: 'training.activate',
    method: 'POST',
    endpoint: '/api/clients/c1/training-plans/p1/versions/v1/activate',
    body: { revision: 1, activeRevision: 0 },
    label: 'Activar rutina: Nueva rutina',
    clientId: 'c1',
    clientName: 'Ana',
    entityKey: 'p1',
    readEndpoint: '/api/clients/c1/training-plans',
  };
  await training.trainingWrite(activate);
  await assert.rejects(training.trainingWrite(activate), /Ya hay/);
  assert.equal(outbox.getOperations().length, 1);
});

test('HU-021 migration block is not queued; an existing operation becomes failed without deletion or endless retries', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  const { ApiError } = await vite.ssrLoadModule('/src/services/api.ts');
  const evaluation = spec({
    kind: 'evaluation.create',
    endpoint: '/api/clients/c1/evaluations',
    clientId: 'c1',
    body: {
      method: 'perimetros',
      equation: 'not_applicable',
      measurements: { waistCm: 80 },
    },
  });
  await assert.rejects(
    writes.submitWrite(evaluation, async () => {
      throw new ApiError(
        503,
        'EVALUATION_UPGRADE_REQUIRED',
        'Migración pendiente'
      );
    })
  );
  assert.equal(outbox.getOperations().length, 0);
  const id = crypto.randomUUID();
  await outbox.enqueue({ ...evaluation, id });
  handler = () =>
    apiError(503, 'EVALUATION_UPGRADE_REQUIRED', 'Migración pendiente');
  await sync.flushOutbox();
  const operation = outbox.getOperations()[0];
  assert.equal(operation.id, id);
  assert.equal(operation.state, 'failed');
  assert.match(operation.error, /Migración pendiente/);
  const attempts = operation.attempts;
  await sync.flushOutbox();
  assert.equal(outbox.getOperations()[0].attempts, attempts);
});

test('HU-021 a confirmation deadline preserves the original idempotency key despite a late successful response', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
  });
  const id = crypto.randomUUID();
  let resolve, attempted;
  const outcome = await writes.submitWrite(
    spec({
      kind: 'evaluation.create',
      endpoint: '/api/clients/c1/evaluations',
      clientId: 'c1',
    }),
    (headers) => {
      attempted = headers['Idempotency-Key'];
      return new Promise((done) => {
        resolve = done;
      });
    },
    { id, timeoutMs: 5 }
  );
  assert.equal(attempted, id);
  assert.equal(outcome.status, 'queued');
  assert.equal(outcome.operation.id, id);
  resolve({ evaluation: { id: 'already-saved' } });
  await Promise.resolve();
  assert.equal(outbox.getOperations().length, 1);
  handler = (_url, options) => {
    assert.equal(new Headers(options.headers).get('Idempotency-Key'), id);
    return json({ evaluation: { id: 'already-saved' } });
  };
  await sync.flushOutbox();
  assert.equal(outbox.getOperations().length, 0);
});
