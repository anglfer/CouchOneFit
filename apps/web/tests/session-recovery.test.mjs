import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createServer } from 'vite';

let dom, vite, root, ProfessionalPage, createRoot;
let mode, identity, pendingSession, requests, channels, redirects;
const values = {
  'Nombre completo': 'Ana 😀 QA conexión',
  'Fecha de nacimiento': '1990-05-20',
  'Estatura (cm)': '170.5',
  'Peso base (kg)': '70.2',
  'Grasa medida (%)': '20.2',
  'Cintura (cm)': '80.2',
  'Cadera (cm)': '90.2',
  'Objetivo (opcional)': 'Objetivo sintético de regresión',
};
const account = (id) => ({
  id,
  username: id,
  fullName: `Professional ${id}`,
  email: `${id}@example.com`,
  role: 'professional',
  status: 'active',
  subscription: null,
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

before(async () => {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (error.message === 'Not implemented: navigation to another Document')
      redirects += 1;
    else throw error;
  });
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost:5000/app/clientes',
    virtualConsole,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.BroadcastChannel = class extends dom.window.EventTarget {
    constructor() {
      super();
      channels.add(this);
    }
    postMessage(data) {
      for (const channel of channels) {
        if (channel !== this)
          channel.dispatchEvent(
            new dom.window.MessageEvent('message', { data })
          );
      }
    }
    close() {
      channels.delete(this);
    }
  };
  ({ createRoot } = await import('react-dom/client'));
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [
      {
        name: 'test-service-worker',
        resolveId(id) {
          if (id === 'virtual:pwa-register') return '\0test-pwa';
        },
        load(id) {
          if (id === '\0test-pwa')
            return 'export const registerSW = () => () => {};';
        },
      },
    ],
  });
  ({ default: ProfessionalPage } = await vite.ssrLoadModule(
    '/src/features/professional/pages/ProfessionalPage.tsx'
  ));
});
after(async () => {
  await vite?.close();
  dom?.window.close();
});

beforeEach(async () => {
  redirects = 0;
  mode = 'ok';
  identity = 'pro-a';
  requests = [];
  channels = new Set();
  pendingSession = undefined;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    if (mode === 'network') throw new TypeError('Failed to fetch');
    if (url === '/api/auth/csrf')
      return json({ csrfToken: 'synthetic-test-token' });
    if (url === '/api/auth/session' || url === '/api/auth/refresh') {
      if (pendingSession) return pendingSession;
      if (mode === 'unauthorized')
        return json({ error: { code: 'SESSION_INVALID' } }, 401);
      if (mode === 'forbidden')
        return json({ error: { code: 'ACCESS_DENIED' } }, 403);
      return json({ account: account(identity) });
    }
    if (mode === 'profile-network' && url === '/api/professional/profile')
      throw new TypeError('Failed to fetch');
    if (url === '/api/clients' && options.method === 'POST') {
      if (mode === 'write-network') throw new TypeError('Failed to fetch');
      return json({ client: { id: 'synthetic-client' } }, 201);
    }
    if (url === '/api/professional/profile')
      return json({ profile: { userId: identity, ...account(identity) } });
    if (url === '/api/me/subscription')
      return json({
        subscription: { status: 'active', used: 0, remaining: 10 },
      });
    if (url === '/api/clients' && (!options.method || options.method === 'GET'))
      return json({ clients: [] });
    throw Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(React.createElement(ProfessionalPage));
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
});

function field(label) {
  return (
    [...document.querySelectorAll('label')]
      .find((element) => element.textContent.trim().startsWith(label))
      ?.querySelector('input,textarea') ?? null
  );
}

function fillDraft() {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  for (const [id, value] of Object.entries(values)) {
    const input = field(id);
    assert.ok(input, `Missing field ${id}`);
    setter.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
}
function assertDraft() {
  for (const [id, value] of Object.entries(values))
    assert.equal(field(id)?.value, value, id);
}
async function focus() {
  await act(async () => {
    window.dispatchEvent(new window.Event('focus'));
  });
}

test('transient session failure preserves the mounted draft and retry/online never submit it', async () => {
  await act(async () => fillDraft());
  const input = field('Nombre completo');
  mode = 'network';
  await focus();
  assert.match(document.body.textContent, /No pudimos comprobar tu sesión/);
  assert.equal(input.closest('[hidden]')?.hasAttribute('inert'), true);
  assertDraft();
  // Explicit retry while still offline must not unmount the draft either.
  const retry = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Reintentar'
  );
  await act(async () => retry.click());
  assert.equal(field('Nombre completo'), input);
  mode = 'ok';
  await act(async () => window.dispatchEvent(new window.Event('online')));
  assert.equal(field('Nombre completo'), input);
  assert.equal(input.closest('[hidden]'), null);
  assertDraft();
  assert.equal(
    requests.some((request) => request.method !== 'GET'),
    false
  );
  assert.equal(localStorage.length, 0);
  assert.equal(sessionStorage.length, 0);
  assert.equal(redirects, 0);
});

for (const rejection of ['unauthorized', 'forbidden']) {
  test(`${rejection} session discards the draft instead of treating it as a network error`, async () => {
    await act(async () => fillDraft());
    mode = rejection;
    await focus();
    assert.equal(field('Nombre completo'), null);
    assert.equal(redirects, 1);
    mode = 'ok';
    await focus();
    assert.equal(field('Nombre completo')?.value, '');
  });
}

test('another account gets a fresh subtree and cannot see the preceding account draft', async () => {
  await act(async () => fillDraft());
  const previous = field('Nombre completo');
  mode = 'network';
  await focus();
  identity = 'pro-b';
  mode = 'ok';
  await focus();
  const current = field('Nombre completo');
  assert.notEqual(current, previous);
  assert.equal(current.value, '');
});

test('a changed identity discards the previous draft even if its profile cannot be loaded', async () => {
  await act(async () => fillDraft());
  identity = 'pro-b';
  mode = 'profile-network';
  await focus();
  assert.equal(field('Nombre completo'), null);
  identity = 'pro-a';
  mode = 'ok';
  await focus();
  assert.equal(field('Nombre completo').value, '');
});

test('a failed manual save keeps every field and reconnection never retries the write', async () => {
  await act(async () => fillDraft());
  mode = 'write-network';
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.match(document.body.textContent, /No pudimos crear el expediente/);
  assert.doesNotMatch(
    document.body.textContent,
    /El expediente se guardó correctamente/
  );
  assertDraft();
  mode = 'ok';
  await act(async () => window.dispatchEvent(new window.Event('online')));
  assertDraft();
  assert.equal(
    requests.filter(
      (request) => request.url === '/api/clients' && request.method === 'POST'
    ).length,
    1
  );
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.equal(
    requests.filter(
      (request) => request.url === '/api/clients' && request.method === 'POST'
    ).length,
    2
  );
  assert.match(
    document.body.textContent,
    /El expediente se guardó correctamente/
  );
  assert.equal(field('Nombre completo').value, '');
});

test('session-cleared notification defeats a pending successful check and discards the draft', async () => {
  await act(async () => fillDraft());
  let resolve;
  pendingSession = new Promise((done) => {
    resolve = done;
  });
  await focus();
  await act(async () => {
    const channel = new BroadcastChannel('couchonefit-session');
    channel.postMessage({ type: 'session-cleared' });
    channel.close();
    resolve(json({ account: account(identity) }));
  });
  assert.equal(field('Nombre completo'), null);
});
