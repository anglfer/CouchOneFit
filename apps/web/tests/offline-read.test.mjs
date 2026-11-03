import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// DEC-018 fase 1: caché de lectura cifrada para el uso sin conexión.
let vite, dom;
let cache, store, status, session, realNow;

const json = (body, statusCode = 200) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
const account = (id) => ({
  id,
  username: id,
  fullName: `Profesional ${id}`,
  email: `${id}@example.com`,
  role: 'professional',
  status: 'active',
  subscription: null,
});
const clientList = {
  clients: [
    { id: 'c1', fullName: 'Ana Torres', goal: 'Constancia', status: 'active' },
    { id: 'c2', fullName: 'Diego Valdés', goal: 'Fuerza', status: 'inactive' },
  ],
  hasClients: true,
  pageInfo: { pageSize: 20, hasMore: false, nextCursor: null },
};

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
  cache = await vite.ssrLoadModule('/src/services/offline/readCache.ts');
  store = await vite.ssrLoadModule('/src/services/offline/store.ts');
  status = await vite.ssrLoadModule('/src/services/offline/status.ts');
  session = await vite.ssrLoadModule('/src/features/auth/services/session.ts');
  realNow = Date.now;
});
after(async () => {
  Date.now = realNow;
  await vite?.close();
  dom?.window.close();
});

beforeEach(async () => {
  Date.now = realNow;
  store.setOfflineStore(store.createMemoryStore());
  await cache.clearOfflineData();
});

const memory = () => store.getStore();

test('guarda cifrado: el contenido no queda a la vista en el almacén', async () => {
  await cache.noteAccount('pro-a');
  await cache.rememberRead(
    '/api/clients?search=&status=&pageSize=20',
    clientList
  );
  const keys = await memory().keys('readCache');
  assert.ok(keys.length >= 1);
  for (const key of keys) {
    assert.ok(!key.includes('clients'), 'la ruta no se guarda en claro');
    const entry = await memory().get('readCache', key);
    const raw = Buffer.from(entry.payload.data).toString('latin1');
    assert.ok(!raw.includes('Ana Torres'));
  }
  const back = await cache.recallRead(
    '/api/clients?search=&status=&pageSize=20'
  );
  assert.deepEqual(back.data, clientList);
});

test('solo se guardan lecturas permitidas', () => {
  for (const ok of [
    '/api/auth/session',
    '/api/professional/profile',
    '/api/me/subscription',
    '/api/clients?search=&status=&pageSize=20',
    '/api/clients/abc',
    '/api/clients/abc/record',
    '/api/admin/plans',
    '/api/admin/professionals?page=1',
  ])
    assert.equal(cache.isCacheableRead(ok), true, ok);
  for (const no of [
    '/api/admin/support/clients?q=a',
    '/api/admin/support/log?pageSize=10',
    '/api/accounts/recovery-targets',
    '/api/me/payments',
    '/api/me/payments/123',
    '/api/clients/abc/invitations',
    '/api/auth/csrf',
  ])
    assert.equal(cache.isCacheableRead(no), false, no);
});

test('una cuenta no lee lo guardado por otra y el cambio de cuenta lo borra', async () => {
  await cache.noteAccount('pro-a');
  await cache.rememberRead('/api/professional/profile', {
    profile: { userId: 'pro-a' },
  });
  await cache.noteAccount('pro-b');
  assert.deepEqual(await memory().keys('readCache'), []);
  assert.equal(await cache.recallRead('/api/professional/profile'), null);
});

test('caduca a los 30 días y se elimina', async () => {
  await cache.noteAccount('pro-a');
  await cache.rememberRead('/api/me/subscription', {
    subscription: { status: 'active' },
  });
  const start = realNow();
  Date.now = () => start + cache.MAX_AGE_MS - 1000;
  assert.ok(await cache.recallRead('/api/me/subscription'));
  Date.now = () => start + cache.MAX_AGE_MS + 1000;
  assert.equal(await cache.recallRead('/api/me/subscription'), null);
  assert.equal((await memory().keys('readCache')).length, 0);
});

test('la búsqueda y el filtro de la cartera funcionan con lo guardado', async () => {
  await cache.noteAccount('pro-a');
  await cache.rememberRead(
    '/api/clients?search=&status=&pageSize=20',
    clientList
  );
  const byName = await cache.recallRead(
    '/api/clients?search=ana&status=&pageSize=20'
  );
  assert.deepEqual(
    byName.data.clients.map((c) => c.id),
    ['c1']
  );
  const inactive = await cache.recallRead(
    '/api/clients?search=&status=inactive&pageSize=20'
  );
  assert.deepEqual(
    inactive.data.clients.map((c) => c.id),
    ['c2']
  );
  assert.equal(
    await cache.recallRead(
      '/api/clients?search=&status=&pageSize=20&cursor=zzz'
    ),
    null
  );
});

test('cerrar sesión borra todo lo guardado', async () => {
  await cache.noteAccount('pro-a');
  await cache.rememberRead('/api/professional/profile', { profile: {} });
  await session.clearSessionState(false);
  assert.deepEqual(await memory().keys('readCache'), []);
  assert.equal(await memory().get('meta', 'lastAccountId'), undefined);
});

test('sessionRequest sirve lo guardado solo cuando no hay conexión', async () => {
  let mode = 'ok';
  globalThis.fetch = async (url) => {
    if (mode === 'network') throw new TypeError('Failed to fetch');
    if (mode === 'unauthorized')
      return json({ error: { code: 'SESSION_INVALID' } }, 401);
    if (mode === 'server') return json({ error: { code: 'BOOM' } }, 500);
    if (mode === 'gateway')
      return json({ error: { code: 'BAD_GATEWAY' } }, 503);
    if (url === '/api/auth/session') return json({ account: account('pro-a') });
    if (url === '/api/professional/profile')
      return json({ profile: { userId: 'pro-a', fullName: 'Ana' } });
    if (url === '/api/admin/support/log?pageSize=10')
      return json({ entries: [] });
    return json({ error: { code: 'NOT_FOUND' } }, 404);
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  await session.sessionRequest('/api/auth/session');
  await session.sessionRequest('/api/professional/profile');
  await session.sessionRequest('/api/admin/support/log?pageSize=10');
  await settle();
  assert.equal(status.getOfflineData().staleSince, null);

  mode = 'network';
  const profile = await session.sessionRequest('/api/professional/profile');
  assert.equal(profile.profile.fullName, 'Ana');
  assert.ok(
    status.getOfflineData().staleSince !== null,
    'queda marcado como dato guardado'
  );
  const identity = await session.sessionRequest('/api/auth/session');
  assert.equal(identity.account.id, 'pro-a');

  await assert.rejects(
    session.sessionRequest('/api/admin/support/log?pageSize=10'),
    TypeError,
    'lo auditado nunca sale del almacén local'
  );

  mode = 'gateway';
  assert.equal(
    (await session.sessionRequest('/api/professional/profile')).profile
      .fullName,
    'Ana'
  );

  mode = 'server';
  await assert.rejects(
    session.sessionRequest('/api/professional/profile'),
    (e) => e.status === 500
  );

  mode = 'unauthorized';
  await assert.rejects(session.sessionRequest('/api/professional/profile'));
  status.reportFresh();
});

test('una lectura nueva con conexión quita la marca de dato guardado', async () => {
  status.reportServedFromCache(realNow() - 60_000);
  assert.ok(status.getOfflineData().staleSince !== null);
  globalThis.fetch = async () => json({ account: account('pro-a') });
  await session.sessionRequest('/api/auth/session');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(status.getOfflineData().staleSince, null);
});

test('al iniciar otra cuenta se descarta lo guardado de la anterior', async () => {
  let current = 'pro-a';
  globalThis.fetch = async (url) =>
    url === '/api/auth/session'
      ? json({ account: account(current) })
      : json({ profile: { userId: current, fullName: `Perfil ${current}` } });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  await session.sessionRequest('/api/auth/session');
  await session.sessionRequest('/api/professional/profile');
  await settle();
  assert.ok((await memory().keys('readCache')).length >= 2);
  current = 'pro-b';
  await session.sessionRequest('/api/auth/session');
  await settle();
  const profileA = await cache.recallRead('/api/professional/profile');
  assert.equal(profileA, null, 'el perfil de la cuenta anterior ya no está');
});
