import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createServer } from 'vite';

let dom, vite, root, ProfessionalPage, createRoot;
let mode, identity, pendingSession, requests, channels, redirects;
let portfolioResponder,
  recordResponder,
  composedResponder,
  invitationResponder,
  editResponder,
  accountResponder,
  statusResponder,
  subscriptionResponder;
let evaluationResponder, historyResponder;
const page = (clients = [], hasClients = false, nextCursor = null) =>
  json({
    clients,
    hasClients,
    pageInfo: { pageSize: 20, hasMore: !!nextCursor, nextCursor },
  });
const sampleClient = (id, fullName) => ({
  id,
  fullName,
  goal: null,
  status: 'inactive',
  userId: null,
  invitationExpiresAt: null,
});
const values = {
  'Nombre completo': 'Ana 😀 QA conexión',
  'Fecha de nacimiento': '1990-05-20',
  'Estatura (cm)': '170.5',
  'Peso base (kg)': '70.2',
  'Grasa medida (%)': '20.2',
  'Cintura (cm)': '80.2',
  'Cadera (cm)': '90.2',
  'Objetivo (opcional)': 'Recomposición corporal',
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

const editableRecord = {
  id: 'edit-id',
  version: 1,
  fullName: 'Original client',
  goal: null,
  status: 'active',
  birthDate: '1990-05-20',
  heightCm: 170.5,
  baseWeightKg: 70.2,
  baseBodyFatPercentage: null,
  waistCm: null,
  hipCm: null,
};
const unavailableSections = () =>
  Object.fromEntries(
    [
      'nutritionPlan',
      'trainingPlan',
      'evaluations',
      'progress',
      'bodyWeightHistory',
    ].map((key) => [
      key,
      key === 'evaluations'
        ? { status: 'empty' }
        : { status: 'not_integrated' },
    ])
  );
const composed = (profile = editableRecord, sections = unavailableSections()) =>
  json({ record: { profile, sections } });
async function openEditor() {
  portfolioResponder = () =>
    page([sampleClient('edit-id', 'Original client')], true);
  recordResponder = () => json({ client: editableRecord });
  await searchFor('Original');
  await act(async () =>
    [...document.querySelectorAll('a')]
      .find((element) => element.textContent === 'Original client')
      .click()
  );
  await act(async () => button('Editar datos base').click());
}
async function editField(label, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set.call(field(label), value);
    field(label).dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function submitEdit() {
  await act(async () =>
    document
      .querySelector('form[aria-label="Editar datos base"]')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
}
const writes = () => requests.filter((request) => request.method === 'PATCH');

test('HU-017 editor sends only changed base fields, validates precision and renders server field errors', async () => {
  await openEditor();
  assert.equal(field('Nombre completo').value, 'Original client');
  await editField('Peso base (kg)', '70.25');
  await submitEdit();
  assert.equal(writes().length, 0);
  assert.match(document.body.textContent, /incrementos de 0.1/);
  await editField('Peso base (kg)', '71.2');
  editResponder = () =>
    json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Revisa los campos.',
          fields: { baseWeightKg: 'Server field rejection' },
        },
      },
      400
    );
  await submitEdit();
  assert.equal(field('Peso base (kg)').value, '71.2');
  assert.match(document.body.textContent, /Server field rejection/);
  editResponder = (body) => {
    assert.deepEqual(body, { version: 1, baseWeightKg: 71.2 });
    return json({
      client: { ...editableRecord, baseWeightKg: 71.2, version: 2 },
    });
  };
  await submitEdit();
  assert.equal(field('Peso base (kg)'), null);
  assert.match(
    document.body.textContent,
    /Los cambios se guardaron correctamente/
  );
  assert.match(document.body.textContent, /71.2 kg/);
});

test('HU-017 conflict keeps draft and requires comparison and explicit reapply without reverting untouched remote fields', async () => {
  await openEditor();
  await editField('Nombre completo', 'My 😀 draft');
  editResponder = () =>
    json(
      {
        error: {
          code: 'CLIENT_RECORD_CONFLICT',
          message: 'El expediente cambió.',
        },
      },
      409
    );
  await submitEdit();
  assert.equal(field('Nombre completo').value, 'My 😀 draft');
  assert.equal(button('Guardar cambios').disabled, true);
  recordResponder = () =>
    json({ client: { ...editableRecord, version: 2, goal: 'Definición' } });
  await act(async () => button('Consultar estado actual').click());
  assert.equal(field('Nombre completo').value, 'My 😀 draft');
  assert.equal(writes().length, 1);
  await act(async () =>
    button('Usar esta versión para reaplicar mi borrador').click()
  );
  assert.equal(field('Objetivo (opcional)').value, 'Definición');
  assert.equal(writes().length, 1);
  editResponder = (body) => {
    assert.deepEqual(body, { version: 2, fullName: 'My 😀 draft' });
    return json({
      client: {
        ...editableRecord,
        version: 3,
        goal: 'Definición',
        fullName: body.fullName,
      },
    });
  };
  await submitEdit();
  assert.equal(writes().length, 2);
});

test('goal is a dropdown with predefined options and an "Otro" free-text escape', async () => {
  await openEditor();
  const select = () => field('Objetivo (opcional)');
  const choose = (value) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value'
      ).set.call(select(), value);
      select().dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  assert.equal(select().tagName, 'SELECT');
  assert.deepEqual(
    [...select().options].map((option) => option.textContent),
    [
      'Sin objetivo definido',
      'Recomposición corporal',
      'Definición',
      'Ganar masa muscular',
      'Otro',
    ]
  );
  assert.equal(field('Especifica el objetivo'), null);
  await choose('__other__');
  assert.equal(field('Especifica el objetivo').required, true);
  await editField('Especifica el objetivo', 'Preparar maratón');
  assert.equal(select().value, '__other__');
  await choose('Definición');
  assert.equal(field('Especifica el objetivo'), null);
  assert.equal(select().value, 'Definición');
});

test('professional deactivates a linked client account only after explicit confirmation and may retry safely', async () => {
  const linked = (status) => ({
    ...sampleClient('edit-id', 'Original client'),
    status: 'active',
    userId: 'account-1',
    accountStatus: status,
  });
  portfolioResponder = () => page([linked('active')], true);
  await searchFor('Original');
  const accountWrites = () =>
    requests.filter((r) => r.method === 'PATCH' && r.url.endsWith('/account'));
  await act(async () => button('Dar de baja la cuenta').click());
  assert.ok(document.querySelector('dialog[open]'));
  assert.equal(document.activeElement, button('Cancelar cambio de cuenta'));
  await act(async () => button('Cancelar cambio de cuenta').click());
  assert.equal(accountWrites().length, 0);
  await act(async () => button('Dar de baja la cuenta').click());
  accountResponder = () => {
    throw new TypeError('Failed to fetch');
  };
  await act(async () => button('Confirmar baja de cuenta').click());
  assert.equal(accountWrites().length, 1);
  assert.match(document.body.textContent, /repetir la operación no duplica/);
  assert.ok(document.querySelector('dialog[open]'));
  accountResponder = (body) => {
    assert.deepEqual(body, { status: 'inactive' });
    return json({
      account: { clientId: 'edit-id', accountStatus: 'inactive' },
    });
  };
  portfolioResponder = () => page([linked('inactive')], true);
  await act(async () => button('Confirmar baja de cuenta').click());
  assert.equal(accountWrites().length, 2);
  assert.equal(document.querySelector('dialog'), null);
  assert.match(
    document.body.textContent,
    /La cuenta de Original client está dada de baja/
  );
  assert.ok(button('Reactivar cuenta'));
  assert.match(document.body.textContent, /Cuenta vinculada dada de baja/);
});

test('HU-017 lost save response is uncertain, survives session network recovery and never retries automatically', async () => {
  await openEditor();
  await editField('Nombre completo', 'Uncertain draft');
  await submitEdit();
  assert.match(document.body.textContent, /resultado es incierto/);
  assert.equal(writes().length, 1);
  mode = 'network';
  await focus();
  mode = 'ok';
  await act(async () => window.dispatchEvent(new window.Event('online')));
  assert.equal(field('Nombre completo').value, 'Uncertain draft');
  assert.equal(writes().length, 1);
  recordResponder = () =>
    json({
      client: { ...editableRecord, version: 2, fullName: 'Uncertain draft' },
    });
  await act(async () => button('Consultar estado actual').click());
  assert.equal(writes().length, 1);
  await act(async () =>
    button('Usar esta versión para reaplicar mi borrador').click()
  );
  await submitEdit();
  assert.equal(writes().length, 1);
  assert.match(document.body.textContent, /No hay cambios para guardar/);
});

test('HU-017 business 403 preserves editor and explicit session renewal never repeats PATCH', async () => {
  await openEditor();
  await editField('Nombre completo', 'Business draft');
  for (const code of [
    'SUBSCRIPTION_SUSPENDED',
    'PLAN_REQUIRED',
    'CSRF_INVALID',
  ]) {
    editResponder = () => json({ error: { code, message: code } }, 403);
    await submitEdit();
    assert.equal(field('Nombre completo').value, 'Business draft');
  }
  editResponder = () => json({ error: { code: 'SESSION_REQUIRED' } }, 401);
  const count = writes().length;
  await submitEdit();
  assert.equal(writes().length, count + 1);
  assert.equal(field('Nombre completo').value, 'Business draft');
  assert.match(document.body.textContent, /Sesión renovada/);
});

test('HU-017 refresh revealing another account destroys the editor without replaying its write', async () => {
  await openEditor();
  await editField('Nombre completo', 'Previous account draft');
  identity = 'pro-b';
  editResponder = () => json({ error: { code: 'SESSION_REQUIRED' } }, 401);
  await submitEdit();
  assert.equal(writes().length, 1);
  assert.equal(field('Nombre completo'), null);
  assert.equal(
    document.querySelector('form[aria-label="Editar datos base"]'),
    null
  );
});

for (const reason of ['unauthorized', 'forbidden', 'other-account', 'logout'])
  test(`HU-017 ${reason} destroys the preceding session editor`, async () => {
    await openEditor();
    await editField('Nombre completo', 'Private edit draft');
    if (reason === 'other-account') identity = 'pro-b';
    else if (reason === 'logout') {
      await act(async () => {
        const channel = new BroadcastChannel('couchonefit-session');
        channel.postMessage({ type: 'session-cleared' });
        channel.close();
      });
    } else mode = reason;
    if (reason !== 'logout') await focus();
    assert.equal(field('Nombre completo'), null);
    assert.doesNotMatch(document.body.textContent, /Private edit draft/);
    assert.equal(
      document.querySelector('form[aria-label="Editar datos base"]'),
      null
    );
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
  globalThis.PopStateEvent = window.PopStateEvent;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
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
  portfolioResponder = () => page();
  recordResponder = () => json({ error: { code: 'CLIENT_NOT_FOUND' } }, 404);
  composedResponder = null;
  invitationResponder = () =>
    json({ code: 'synthetic-invitation', expiresAt: '2026-12-01T00:00:00Z' });
  editResponder = () => {
    throw new TypeError('Failed to fetch');
  };
  statusResponder = () => {
    throw new TypeError('Failed to fetch');
  };
  subscriptionResponder = () =>
    json({ subscription: { status: 'active', used: 0, remaining: 10 } });
  evaluationResponder = () => json({ error: { code: 'UNEXPECTED' } }, 500);
  historyResponder = null;
  window.history.replaceState({}, '', '/app/clientes');
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body });
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
    if (url.endsWith('/invitations'))
      return invitationResponder(options.method);
    if (url.endsWith('/account') && options.method === 'PATCH')
      return accountResponder(JSON.parse(options.body));
    if (url.endsWith('/status') && options.method === 'PATCH')
      return statusResponder(JSON.parse(options.body));
    if (url.includes('/evaluation-history?') && historyResponder)
      return historyResponder(url);
    if (url.endsWith('/evaluations') && options.method === 'POST')
      return evaluationResponder(JSON.parse(options.body));
    if (url.startsWith('/api/clients/') && options.method === 'PATCH')
      return editResponder(JSON.parse(options.body));
    if (mode === 'profile-business' && url === '/api/professional/profile')
      return json(
        {
          error: { code: 'SUBSCRIPTION_SUSPENDED', message: 'Business denial' },
        },
        403
      );
    if (url === '/api/professional/profile')
      return json({ profile: { userId: identity, ...account(identity) } });
    if (url === '/api/me/subscription') return subscriptionResponder();
    // Portfolio rows add the training summary when it is available.
    if (url === '/api/training/clients') return json({ clients: [] });
    if (
      url.startsWith('/api/clients?') &&
      (!options.method || options.method === 'GET')
    )
      return portfolioResponder(new URL(url, window.location.origin));
    if (
      url.startsWith('/api/clients/') &&
      url.endsWith('/record') &&
      (!options.method || options.method === 'GET')
    ) {
      if (composedResponder) return composedResponder(url);
      // Legacy tests keep exercising the same profile/HTTP failures. The
      // availability envelope is only a test double, not an application stub.
      const response = await recordResponder(url.slice(0, -'/record'.length));
      if (!response.ok) return response;
      const body = await response.json();
      return composed(body.client);
    }
    if (
      url.startsWith('/api/clients/') &&
      (!options.method || options.method === 'GET')
    )
      return recordResponder(url);
    throw Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(React.createElement(ProfessionalPage));
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  const store = await vite.ssrLoadModule('/src/services/offline/store.ts');
  const outbox = await vite.ssrLoadModule('/src/services/offline/outbox.ts');
  store.setOfflineStore(undefined);
  outbox.resetOutboxForTests();
});

function field(label) {
  return (
    [...document.querySelectorAll('label')]
      .find((element) => element.textContent.trim().startsWith(label))
      ?.querySelector('input,textarea,select') ?? null
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
    if (input.tagName === 'SELECT') {
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value'
      ).set.call(input, value);
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    } else {
      setter.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
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
  const subscriptionReads = () =>
    requests.filter((request) => request.url === '/api/me/subscription').length;
  const beforeSave = subscriptionReads();
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
  // HU-015 consumes a place: the capacity summary refreshes after the create.
  assert.equal(subscriptionReads(), beforeSave + 1);
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

async function searchFor(value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set.call(field('Buscar por nombre'), value);
    field('Buscar por nombre').dispatchEvent(
      new window.Event('input', { bubbles: true })
    );
  });
  await act(async () =>
    document
      .querySelector('form[aria-label="Buscar en mi cartera"]')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
}
function button(text) {
  return [...document.querySelectorAll('button')].find(
    (element) => element.textContent === text
  );
}

test('portfolio distinguishes empty, loading, no matches and error and ignores stale search results', async () => {
  assert.match(document.body.textContent, /Tu cartera está vacía/);
  let oldResolve, currentResolve;
  portfolioResponder = (url) => {
    if (url.searchParams.get('search') === 'old')
      return new Promise((resolve) => {
        oldResolve = resolve;
      });
    return new Promise((resolve) => {
      currentResolve = resolve;
    });
  };
  await searchFor('old');
  assert.match(document.body.textContent, /Cargando expedientes/);
  await searchFor('%_');
  await act(async () =>
    currentResolve(page([sampleClient('new', 'Literal %_')], true))
  );
  assert.match(document.body.textContent, /Literal %_/);
  await act(async () =>
    oldResolve(page([sampleClient('old', 'Outdated result')], true))
  );
  assert.doesNotMatch(document.body.textContent, /Outdated result/);
  assert.ok(
    requests.some(
      (request) =>
        new URL(request.url, window.location.origin).searchParams.get(
          'search'
        ) === '%_'
    )
  );
  portfolioResponder = () => page([], true);
  await searchFor('absent');
  assert.match(
    document.body.textContent,
    /No hay resultados para estos filtros/
  );
  assert.doesNotMatch(document.body.textContent, /Tu cartera está vacía/);
  portfolioResponder = () => {
    throw new TypeError('offline');
  };
  await searchFor('failure');
  assert.match(
    document.body.textContent,
    /No pudimos consultar los expedientes/
  );
  assert.doesNotMatch(
    document.body.textContent,
    /No hay resultados para estos filtros/
  );
  portfolioResponder = () =>
    page([sampleClient('recovered', 'Recovered client')], true);
  await act(async () => button('Reintentar consulta').click());
  assert.match(document.body.textContent, /Recovered client/);
});

test('portfolio search counts Unicode code points and rejects overlong searches locally', async () => {
  const value = '😀'.repeat(150);
  await searchFor(value);
  assert.equal(field('Buscar por nombre').checkValidity(), true);
  const searches = () =>
    requests.filter((request) => request.url.startsWith('/api/clients?'));
  assert.equal(
    new URL(searches().at(-1).url, window.location.origin).searchParams.get(
      'search'
    ),
    value
  );
  const count = searches().length;
  await searchFor(value + 'a');
  assert.equal(field('Buscar por nombre').checkValidity(), false);
  assert.equal(searches().length, count);
  await searchFor('valid');
  assert.equal(field('Buscar por nombre').checkValidity(), true);
  assert.equal(searches().length, count + 1);
});

test('portfolio previous/next and status reset retain applied filters and protect the creation draft', async () => {
  await act(async () => fillDraft());
  portfolioResponder = (url) =>
    url.searchParams.has('cursor')
      ? page([sampleClient('second', 'Second page')], true)
      : page([sampleClient('first', 'First page')], true, 'next-cursor');
  await searchFor('literal');
  await act(async () => button('Siguiente').click());
  assert.match(document.body.textContent, /Second page/);
  assert.match(document.body.textContent, /Página 2/);
  assert.equal(button('Siguiente').disabled, true);
  await act(async () => button('Anterior').click());
  assert.match(document.body.textContent, /First page/);
  assertDraft();
  await act(async () => {
    field('Estado').value = 'inactive';
    field('Estado').dispatchEvent(
      new window.Event('change', { bubbles: true })
    );
  });
  const last = new URL(
    requests.filter((request) => request.url.startsWith('/api/clients?')).at(-1)
      .url,
    window.location.origin
  );
  assert.equal(last.searchParams.get('search'), 'literal');
  assert.equal(last.searchParams.get('status'), 'inactive');
  assert.equal(last.searchParams.has('cursor'), false);
  assertDraft();
});

test('selected client has a read-only base view with loading, nullable data and recoverable error', async () => {
  let resolve;
  portfolioResponder = () =>
    page([sampleClient('client-id', 'Selected client')], true);
  await searchFor('Selected');
  recordResponder = () =>
    new Promise((done) => {
      resolve = done;
    });
  await act(async () =>
    [...document.querySelectorAll('a')]
      .find((element) => element.textContent === 'Selected client')
      .click()
  );
  assert.match(document.body.textContent, /Cargando expediente/);
  await act(async () =>
    resolve(
      json({
        client: {
          id: 'client-id',
          version: 1,
          fullName: 'Selected client',
          status: 'inactive',
          goal: null,
          birthDate: null,
          heightCm: 170.5,
          baseWeightKg: 70.2,
          baseBodyFatPercentage: null,
          waistCm: null,
          hipCm: null,
        },
      })
    )
  );
  assert.match(document.body.textContent, /170.5 cm/);
  assert.match(document.body.textContent, /70.2 kg/);
  assert.match(document.body.textContent, /Sin registrar/);
  assert.equal(document.querySelector('form'), null);
  assert.equal(document.querySelector('input'), null);
  recordResponder = () => json({ error: { code: 'CLIENT_NOT_FOUND' } }, 404);
  await act(async () => {
    window.history.pushState({}, '', '/app/clientes/foreign-id');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  });
  assert.match(document.body.textContent, /No pudimos consultar el expediente/);
  assert.doesNotMatch(document.body.textContent, /Selected client/);
  recordResponder = () =>
    json({
      client: {
        id: 'foreign-id',
        version: 1,
        fullName: 'Recovered detail',
        status: 'active',
        birthDate: null,
        heightCm: null,
        baseWeightKg: null,
        baseBodyFatPercentage: null,
        waistCm: null,
        hipCm: null,
        goal: null,
      },
    });
  await act(async () => button('Reintentar lectura').click());
  assert.match(document.body.textContent, /Recovered detail/);
});

test('portfolio invitations keep their recipient and block pagination while issuing a code', async () => {
  portfolioResponder = () =>
    page(
      [
        {
          ...sampleClient('invite-id', 'Invitation recipient'),
          status: 'active',
        },
      ],
      true,
      'page-two'
    );
  await searchFor('Invitation');
  let resolve;
  invitationResponder = () =>
    new Promise((done) => {
      resolve = done;
    });
  await act(async () => button('Generar invitación').click());
  assert.equal(button('Siguiente').disabled, true);
  assert.equal(field('Buscar por nombre').disabled, true);
  await act(async () =>
    resolve(
      json({ code: 'synthetic-invitation', expiresAt: '2026-12-01T00:00:00Z' })
    )
  );
  assert.match(
    document.body.textContent,
    /Invitación para Invitation recipient/
  );
  assert.equal(
    document.querySelector('input[readonly]').value,
    'synthetic-invitation'
  );
  assert.equal(button('Siguiente').disabled, false);
  invitationResponder = () => new Response(null, { status: 204 });
  await act(async () => button('Revocar invitación').click());
  assert.equal(document.querySelector('input[readonly]'), null);
  assert.ok(
    requests.some(
      (request) =>
        request.url === '/api/clients/invite-id/invitations' &&
        request.method === 'DELETE'
    )
  );
});

test('HU-017 business rejection during profile checking retains the hidden editor until recovery', async () => {
  await openEditor();
  await editField('Nombre completo', 'Business check draft');
  const input = field('Nombre completo');
  mode = 'profile-business';
  await focus();
  assert.equal(field('Nombre completo'), input);
  assert.ok(input.closest('[hidden]'));
  mode = 'ok';
  await focus();
  assert.equal(field('Nombre completo'), input);
  assert.equal(input.value, 'Business check draft');
  assert.equal(input.closest('[hidden]'), null);
  assert.equal(writes().length, 0);
});

const statusWrites = () =>
  requests.filter(
    (request) => request.method === 'PATCH' && request.url.endsWith('/status')
  );
async function openStatusFixture(inDetail = false, initialStatus = 'active') {
  portfolioResponder = () =>
    page(
      [
        {
          ...sampleClient('edit-id', 'Original client'),
          status: initialStatus,
        },
      ],
      true
    );
  recordResponder = () =>
    json({ client: { ...editableRecord, status: initialStatus } });
  await searchFor('Original');
  if (inDetail)
    await act(async () =>
      [...document.querySelectorAll('a')]
        .find((element) => element.textContent === 'Original client')
        .click()
    );
  await act(async () =>
    button(
      initialStatus === 'active'
        ? 'Inactivar expediente'
        : 'Reactivar expediente'
    ).click()
  );
}

test('HU-018 confirmation is modal, cancellation/Escape do not send and double confirmation waits for server before list/capacity refresh', async () => {
  await openStatusFixture();
  assert.ok(document.querySelector('dialog[open]'));
  assert.equal(document.activeElement, button('Cancelar cambio de estado'));
  assert.match(
    document.querySelector('dialog').textContent,
    /No se da de baja la cuenta/
  );
  await act(async () => button('Cancelar cambio de estado').click());
  assert.equal(statusWrites().length, 0);
  await act(async () => button('Inactivar expediente').click());
  await act(async () =>
    document
      .querySelector('dialog')
      .dispatchEvent(new window.Event('cancel', { cancelable: true }))
  );
  assert.equal(statusWrites().length, 0);
  await act(async () => button('Inactivar expediente').click());
  let resolve;
  statusResponder = (body) => {
    assert.deepEqual(body, { status: 'inactive', version: 1 });
    return new Promise((done) => {
      resolve = done;
    });
  };
  const subCount = requests.filter(
    (r) => r.url === '/api/me/subscription'
  ).length;
  await act(async () => {
    button('Confirmar inactivación').click();
    button('Procesando…')?.click();
  });
  assert.equal(statusWrites().length, 1);
  assert.equal(button('Cancelar cambio de estado').disabled, true);
  assert.doesNotMatch(
    document.body.textContent,
    /El expediente de Original client está inactivo/
  );
  assert.equal(
    requests.filter((r) => r.url === '/api/me/subscription').length,
    subCount
  );
  portfolioResponder = () =>
    page(
      [{ ...sampleClient('edit-id', 'Original client'), status: 'inactive' }],
      true
    );
  subscriptionResponder = () =>
    json({ subscription: { status: 'active', used: 0, remaining: 10 } });
  await act(async () =>
    resolve(
      json({ client: { ...editableRecord, status: 'inactive', version: 2 } })
    )
  );
  assert.match(
    document.body.textContent,
    /El expediente de Original client está inactivo/
  );
  assert.ok(button('Reactivar expediente'));
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(
    requests.filter((r) => r.url === '/api/me/subscription').length,
    subCount + 1
  );
});

test('HU-018 conflict requires consulting the latest version and explicit confirmation, without automatic retry', async () => {
  await openStatusFixture();
  statusResponder = () =>
    json(
      {
        error: {
          code: 'CLIENT_RECORD_CONFLICT',
          message: 'El expediente cambió.',
        },
      },
      409
    );
  await act(async () => button('Confirmar inactivación').click());
  assert.equal(statusWrites().length, 1);
  assert.equal(button('Confirmar inactivación').disabled, true);
  recordResponder = () => json({ client: { ...editableRecord, version: 2 } });
  await act(async () => button('Consultar estado actual').click());
  assert.equal(statusWrites().length, 1);
  statusResponder = (body) => {
    assert.deepEqual(body, { status: 'inactive', version: 2 });
    return json({
      client: { ...editableRecord, status: 'inactive', version: 3 },
    });
  };
  await act(async () => button('Confirmar inactivación').click());
  assert.equal(statusWrites().length, 2);
});

test('HU-018 uncertain response never replays or flips the original intent when current state is already applied; detail and capacity refresh', async () => {
  await openStatusFixture(true);
  await act(async () => button('Confirmar inactivación').click());
  assert.equal(statusWrites().length, 1);
  assert.match(
    document.body.textContent,
    /No podemos confirmar si cambió el estado/
  );
  assert.equal(button('Confirmar inactivación').disabled, true);
  await act(async () => window.dispatchEvent(new window.Event('online')));
  assert.equal(statusWrites().length, 1);
  recordResponder = () =>
    json({ client: { ...editableRecord, status: 'inactive', version: 2 } });
  await act(async () => button('Consultar estado actual').click());
  assert.match(
    document.body.textContent,
    /El estado solicitado ya está aplicado/
  );
  assert.equal(button('Confirmar reactivación'), undefined);
  const count = requests.filter((r) => r.url === '/api/me/subscription').length;
  await act(async () => button('Actualizar vistas con este estado').click());
  assert.equal(statusWrites().length, 1);
  assert.match(document.body.textContent, /El expediente está inactivo/);
  assert.equal(
    requests.filter((r) => r.url === '/api/me/subscription').length,
    count + 1
  );
});

test('HU-018 business errors keep confirmation and capacity refresh failure retries only the read', async () => {
  await openStatusFixture(false, 'inactive');
  statusResponder = () =>
    json(
      { error: { code: 'CUPO_AGOTADO', message: 'Sin plazas disponibles.' } },
      409
    );
  await act(async () => button('Confirmar reactivación').click());
  assert.match(document.body.textContent, /Sin plazas disponibles/);
  assert.ok(document.querySelector('dialog[open]'));
  assert.equal(statusWrites().length, 1);
  statusResponder = () =>
    json({ client: { ...editableRecord, status: 'active', version: 2 } });
  subscriptionResponder = () => {
    throw new TypeError('read unavailable');
  };
  await act(async () => button('Confirmar reactivación').click());
  assert.match(
    document.body.textContent,
    /El estado se confirmó, pero no pudimos actualizar el cupo/
  );
  const count = statusWrites().length;
  subscriptionResponder = () =>
    json({ subscription: { status: 'active', used: 0, remaining: 10 } });
  await act(async () => button('Actualizar resumen de cupo').click());
  assert.equal(statusWrites().length, count);
  assert.doesNotMatch(
    document.body.textContent,
    /El estado se confirmó, pero no pudimos actualizar el cupo/
  );
});

test('HU-018 modal closes while the session is uncertain and reopens without a write only for the same recovered account', async () => {
  await openStatusFixture();
  assert.ok(document.querySelector('dialog[open]'));
  mode = 'network';
  await focus();
  assert.equal(document.querySelector('dialog[open]'), null);
  assert.ok(document.querySelector('dialog'));
  mode = 'ok';
  await focus();
  assert.ok(document.querySelector('dialog[open]'));
  assert.equal(statusWrites().length, 0);
  identity = 'pro-b';
  await focus();
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(statusWrites().length, 0);
});

async function openComposedRecord(id) {
  await act(async () => {
    window.history.pushState({}, '', `/app/clientes/${id}`);
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  });
}

async function openEvaluationForm() {
  const link = (name) =>
    [...document.querySelectorAll('a')].find((a) => a.textContent === name);
  const tab = [
    ...document.querySelectorAll('nav[aria-label="Secciones del cliente"] a'),
  ].find((a) => a.textContent.trim() === 'Evaluación');
  if (tab) await act(async () => tab.click());
  await act(async () => link('Nueva evaluación').click());
}

test('HU-019 composes the real profile once and labels all absent integrations without invented empty data or measurement dates', async () => {
  composedResponder = () =>
    composed({ ...editableRecord, id: 'record-a', goal: 'Actual base goal' });
  await openComposedRecord('record-a');
  assert.match(document.body.textContent, /Actual base goal/);
  assert.match(document.body.textContent, /70.2 kg/);
  assert.match(
    document.body.textContent,
    /No se dispone de una fecha de medición base/
  );
  assert.equal(
    document.body.textContent.match(/Esta sección todavía no está disponible/g)
      .length,
    3
  );
  assert.match(document.body.textContent, /La evolución aún no está integrada/);
  assert.equal(document.querySelector('form'), null);
  assert.doesNotMatch(
    document.body.textContent,
    /Nueva evaluación|Ver evaluaciones/
  );
  assert.equal(
    requests.filter((r) => r.url === '/api/clients/record-a/record').length,
    1
  );
  assert.equal(
    requests.filter((r) => r.url === '/api/clients/record-a').length,
    0
  );
  assert.equal(
    requests.some((r) => r.method !== 'GET'),
    false
  );
});

test('HU-021 Web submits real measurements from the record and refreshes the dated history', async () => {
  const previous = {
    id: 'evaluation-previous',
    clientId: 'record-a',
    evaluationDate: '2026-11-08',
    createdAt: '2026-11-08T12:00:00.000Z',
    weightKg: 70.1,
    waistCm: null,
    hipCm: null,
    measuredBodyFatPercentage: null,
    pectoralSkinfoldMm: null,
    abdominalSkinfoldMm: null,
    tricepsSkinfoldMm: null,
    suprailiacSkinfoldMm: null,
    thighSkinfoldMm: null,
  };
  let saved = null;
  composedResponder = () =>
    composed(
      { ...editableRecord, id: 'record-a' },
      {
        ...unavailableSections(),
        evaluations: {
          status: 'available',
          evaluations: saved ? [saved, previous] : [previous],
        },
      }
    );
  await openComposedRecord('record-a');
  assert.match(document.body.textContent, /2026-11-08/);
  await openEvaluationForm();
  const input = field('Peso');
  assert.ok(input);
  assert.equal(
    window.location.pathname,
    '/app/clientes/record-a/evaluacion/nueva'
  );
  assert.equal(document.querySelector('dialog'), null);
  assert.ok(
    [...document.querySelectorAll('strong')].some(
      (e) => e.textContent === 'Perímetros corporales'
    )
  );
  await editField('Cintura', '80');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set.call(input, '70.4');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
  evaluationResponder = (body) => {
    assert.deepEqual(body, {
      method: 'perimetros',
      effectiveDate: null,
      equation: 'not_applicable',
      measurements: { waistCm: 80, weightKg: 70.4 },
    });
    saved = {
      id: 'evaluation-1',
      clientId: 'record-a',
      evaluationDate: '2026-11-09',
      createdAt: '2026-11-09T12:00:00.000Z',
      weightKg: 70.4,
      waistCm: null,
      hipCm: null,
      measuredBodyFatPercentage: null,
      pectoralSkinfoldMm: null,
      abdominalSkinfoldMm: null,
      tricepsSkinfoldMm: null,
      suprailiacSkinfoldMm: null,
      thighSkinfoldMm: null,
    };
    return json({ evaluation: saved }, 201);
  };
  await act(async () =>
    document
      .querySelector('form[aria-label="Registrar evaluación antropométrica"]')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.equal(
    requests.filter(
      (r) => r.method === 'POST' && r.url.endsWith('/evaluations')
    ).length,
    1
  );
  assert.match(
    document.body.textContent,
    /La evaluación se guardó correctamente/
  );
  await act(async () =>
    [...document.querySelectorAll('a')]
      .find((a) => a.textContent === 'Volver al historial')
      .click()
  );
  assert.match(document.body.textContent, /Evaluación · 2026-11-09/);
  assert.match(document.body.textContent, /2026-11-08/);
  assert.match(document.body.textContent, /70.4 kg/);
  assert.equal(document.querySelector('dialog[open]'), null);
});

test('HU-021 rejects empty and out-of-range or over-precision entries before sending', async () => {
  composedResponder = () =>
    composed(
      { ...editableRecord, id: 'record-a' },
      { ...unavailableSections(), evaluations: { status: 'empty' } }
    );
  await openComposedRecord('record-a');
  await openEvaluationForm();
  const form = () =>
    document.querySelector(
      'form[aria-label="Registrar evaluación antropométrica"]'
    );
  await act(async () =>
    form().dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    )
  );
  assert.match(document.body.textContent, /al menos una medición válida/);
  const input = field('Peso');
  for (const value of ['29.9', '70.25']) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () =>
      form().dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
    );
    assert.match(
      document.body.textContent,
      /Revisa el rango y usa como máximo un decimal/
    );
  }
  assert.equal(
    requests.some((r) => r.method === 'POST' && r.url.endsWith('/evaluations')),
    false
  );
  assert.equal(field('Peso').value, '70.25');
  assert.equal(field('Peso').getAttribute('aria-invalid'), 'true');
});

test('HU-021 displays a queued offline evaluation as pending, not server-confirmed', async () => {
  const store = await vite.ssrLoadModule('/src/services/offline/store.ts');
  const readCache = await vite.ssrLoadModule(
    '/src/services/offline/readCache.ts'
  );
  const outbox = await vite.ssrLoadModule('/src/services/offline/outbox.ts');
  store.setOfflineStore(store.createMemoryStore());
  outbox.resetOutboxForTests();
  await readCache.noteAccount('pro-a');
  await outbox.loadOutbox('pro-a');
  composedResponder = () =>
    composed(
      { ...editableRecord, id: 'record-a' },
      {
        ...unavailableSections(),
        evaluations: { status: 'empty' },
      }
    );
  evaluationResponder = () => {
    throw new TypeError('Failed to fetch');
  };

  await openComposedRecord('record-a');
  await openEvaluationForm();
  await editField('Peso', '70.4');
  await editField('Cintura', '80');
  await act(async () =>
    document
      .querySelector('form[aria-label="Registrar evaluación antropométrica"]')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );

  for (
    let attempt = 0;
    attempt < 100 && !outbox.getOperations().length;
    attempt++
  ) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  assert.match(document.body.textContent, /pendiente de sincronización/);
  assert.match(document.body.textContent, /fecha de creación se asignará/);
  assert.equal(outbox.getOperations().length, 1);
  assert.equal(document.querySelector('dialog[open]'), null);
  store.setOfflineStore(undefined);
  outbox.resetOutboxForTests();
});

test('HU-019 and HU-021 reader errors stay within their sections and retries do not write', async () => {
  composedResponder = () =>
    composed(
      { ...editableRecord, id: 'record-a' },
      {
        ...unavailableSections(),
        evaluations: { status: 'error', code: 'QUERY_FAILED' },
        progress: { status: 'error', code: 'QUERY_FAILED' },
      }
    );
  await openComposedRecord('record-a');
  assert.match(
    document.body.textContent,
    /No pudimos consultar el resumen de evolución/
  );
  const tab = [
    ...document.querySelectorAll('nav[aria-label="Secciones del cliente"] a'),
  ].find((a) => a.textContent.trim() === 'Evaluación');
  await act(async () => tab.click());
  assert.match(
    document.body.textContent,
    /No pudimos consultar las evaluaciones/
  );
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await act(async () => button('Reintentar lectura').click());
  assert.match(
    document.body.textContent,
    /Aún no hay evaluaciones confirmadas/
  );
  assert.doesNotMatch(
    document.body.textContent,
    /No pudimos consultar las evaluaciones/
  );
  assert.equal(writes().length, 0);
});

test('HU-019 changing client clears the previous profile and ignores its late response', async () => {
  composedResponder = () =>
    composed({ ...editableRecord, id: 'record-a', goal: 'Only A goal' });
  await openComposedRecord('record-a');
  assert.match(document.body.textContent, /Only A goal/);
  let resolveA, resolveB;
  composedResponder = (url) =>
    new Promise((resolve) => {
      if (url.includes('/record-a/')) resolveA = resolve;
      else resolveB = resolve;
    });
  await act(async () => button('Actualizar expediente').click());
  await openComposedRecord('record-b');
  assert.match(document.body.textContent, /Cargando expediente/);
  assert.doesNotMatch(document.body.textContent, /Only A goal/);
  await act(async () =>
    resolveB(
      composed({ ...editableRecord, id: 'record-b', goal: 'Only B goal' })
    )
  );
  await act(async () =>
    resolveA(
      composed({ ...editableRecord, id: 'record-a', goal: 'Late A goal' })
    )
  );
  assert.match(document.body.textContent, /Only B goal/);
  assert.doesNotMatch(document.body.textContent, /Only A goal|Late A goal/);
});

test('HU-019 another professional cannot retain a preceding profile after a failed read or late response', async () => {
  composedResponder = () =>
    composed({ ...editableRecord, id: 'record-a', goal: 'Only A account' });
  await openComposedRecord('record-a');
  let resolveA;
  composedResponder = () =>
    new Promise((resolve) => {
      resolveA = resolve;
    });
  await act(async () => button('Actualizar expediente').click());
  composedResponder = () => json({ error: { code: 'CLIENT_NOT_FOUND' } }, 404);
  identity = 'pro-b';
  await focus();
  await act(async () =>
    resolveA(
      composed({ ...editableRecord, id: 'record-a', goal: 'Late private goal' })
    )
  );
  assert.match(document.body.textContent, /No pudimos consultar el expediente/);
  assert.doesNotMatch(
    document.body.textContent,
    /Only A account|Late private goal|Esta sección todavía/
  );
});

for (const failure of ['server', 'foreign', 'wrong-id', 'malformed']) {
  test(`HU-019 ${failure} never becomes an empty or partially visible record`, async () => {
    composedResponder = () => {
      if (failure === 'server')
        return json({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
      if (failure === 'foreign')
        return json({ error: { code: 'CLIENT_NOT_FOUND' } }, 404);
      if (failure === 'wrong-id')
        return composed({
          ...editableRecord,
          id: 'other',
          goal: 'Forbidden text',
        });
      return json({
        record: {
          profile: { ...editableRecord, id: 'record-a' },
          sections: {},
        },
      });
    };
    await openComposedRecord('record-a');
    assert.match(
      document.body.textContent,
      /No pudimos consultar el expediente/
    );
    assert.doesNotMatch(
      document.body.textContent,
      /Sin registros\.|Forbidden text|Original client|Esta sección todavía/
    );
  });
}

test('HU-018 stale list action keeps the clicked intent when the initial GET already has that state', async () => {
  portfolioResponder = () =>
    page(
      [{ ...sampleClient('edit-id', 'Original client'), status: 'active' }],
      true
    );
  recordResponder = () =>
    json({ client: { ...editableRecord, status: 'inactive', version: 2 } });
  await searchFor('Original');
  await act(async () => button('Inactivar expediente').click());
  assert.match(
    document.querySelector('dialog').textContent,
    /Confirmar inactivación del expediente/
  );
  assert.match(
    document.body.textContent,
    /El estado solicitado ya está aplicado/
  );
  assert.equal(button('Confirmar reactivación'), undefined);
  assert.equal(statusWrites().length, 0);
});

test('HU-021 multimethod form preserves method drafts, previews device composition and exposes anatomical help', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  await openEvaluationForm();
  await editField('Cintura', '80');
  const choose = async (name) =>
    act(async () =>
      [...document.querySelectorAll('button')]
        .find((b) => b.querySelector('strong')?.textContent === name)
        .click()
    );
  await choose('Bioimpedancia');
  await editField('Peso', '80');
  await editField('Grasa corporal medida', '25');
  assert.match(
    document.querySelector('[aria-label="Resultados preliminares"]')
      .textContent,
    /20.0/
  );
  assert.match(
    document.querySelector('svg[role="img"]').getAttribute('aria-label'),
    /25.0/
  );
  assert.equal(field('Cintura'), null);
  await choose('Perímetros corporales');
  assert.equal(field('Cintura').value, '80');
  await act(async () => field('Abdomen umbilical').focus());
  assert.match(
    document.querySelector('[aria-label="Referencia anatómica"]').textContent,
    /no sustituye cintura/
  );
  assert.equal(field('Abdomen umbilical').value, '');
  await choose('Pliegues cutáneos');
  assert.ok(field('Pliegue bicipital'));
  assert.ok(field('Pliegue subescapular'));
  assert.match(document.body.textContent, /cálculo de grasa deshabilitado/);
});

test('HU-021 record evaluation preserves the current client without a selector', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await act(async () => {
    window.history.pushState({}, '', '/app/clientes/record-a/evaluacion');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  });
  const links = [...document.querySelectorAll('a')];
  assert.ok(links.some((a) => a.getAttribute('href') === '/app/clientes'));
  assert.ok(links.some((a) => a.getAttribute('href') === '/app/entrenamiento'));
  assert.equal(document.querySelector('select[aria-label="Cliente"]'), null);
  assert.doesNotMatch(document.body.textContent, /Selecciona un cliente/);
  assert.equal(
    document
      .querySelector(
        'nav[aria-label="Secciones del cliente"] a[aria-current="page"]'
      )
      .textContent.trim(),
    'Evaluación'
  );
  assert.match(document.body.textContent, /Original client/);
  assert.ok(document.querySelector('a[href="/app/clientes/record-a"]'));
  assert.equal(writes().length, 0);
});

test('HU-021 previews independent reference ratios and mass arithmetic without enabling unverified formulas', async () => {
  const { preview } = await vite.ssrLoadModule(
    '/src/features/evaluations/types/assessment.ts'
  );
  assert.deepEqual(
    preview({
      method: 'perimetros',
      equation: 'male',
      effectiveDate: null,
      measurements: {
        waistCm: 80,
        hipCm: 100,
        heightCm: 200,
        abdomenUmbilicalCm: 95,
      },
    }),
    { waistHipRatio: 0.8, waistHeightRatio: 0.4 }
  );
  assert.deepEqual(
    preview({
      method: 'bioimpedancia',
      equation: 'not_applicable',
      effectiveDate: null,
      measurements: {
        weightKg: 80,
        measuredBodyFatPercentage: 25,
        waterLitres: 40,
      },
    }),
    {
      bodyFatPercentage: 25,
      fatMassKg: 20,
      fatFreeMassKg: 60,
      approximateWaterPercentage: 50,
    }
  );
  assert.deepEqual(
    preview({
      method: 'pliegues',
      equation: 'male',
      effectiveDate: null,
      measurements: {
        pectoralSkinfoldMm: 10,
        abdominalSkinfoldMm: 15,
        thighSkinfoldMm: 20,
      },
    }),
    {}
  );
});

test('HU-021 changing segment tissue requires explicit confirmation and clears incompatible draft values', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  await openEvaluationForm();
  await act(async () =>
    [...document.querySelectorAll('button')]
      .find((b) => b.querySelector('strong')?.textContent === 'Bioimpedancia')
      .click()
  );
  await editField('Brazo izquierdo', '2.5');
  const tissue = [...document.querySelectorAll('select')].find((e) =>
    [...e.options].some((o) => o.value === 'muscle_mass')
  );
  const confirm = await vite.ssrLoadModule('/src/services/confirm.ts');
  const change = () =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value'
      ).set.call(tissue, 'fat_mass');
      tissue.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  try {
    confirm.setConfirmHandler(async () => false);
    await change();
    assert.equal(field('Brazo izquierdo').value, '2.5');
    confirm.setConfirmHandler(async () => true);
    await change();
    assert.equal(field('Brazo izquierdo').value, '');
    assert.equal(tissue.value, 'fat_mass');
  } finally {
    confirm.setConfirmHandler(null);
  }
});

test('HU-021 third record tab is the only evaluation entry and there is no global evaluation menu', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  const tabs = [
    ...document.querySelectorAll('nav[aria-label="Secciones del cliente"] a'),
  ];
  assert.deepEqual(
    tabs.map((a) => a.textContent.trim()),
    ['Resumen', 'Entrenamiento', 'Evaluación']
  );
  assert.equal(document.querySelector('a[href="/app/evaluaciones"]'), null);
  assert.equal(document.querySelector('form'), null);
  assert.doesNotMatch(
    document.body.textContent,
    /Ver evaluaciones|Abrir módulo|Nueva evaluación/
  );
  await act(async () => tabs[2].click());
  assert.equal(window.location.pathname, '/app/clientes/record-a/evaluacion');
  assert.equal(document.querySelector('select[aria-label="Cliente"]'), null);
  assert.doesNotMatch(document.body.textContent, /Selecciona un cliente/);
  assert.ok(
    [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'Nueva evaluación'
    )
  );
});

test('HU-021 pending migration preserves the form and never becomes an offline success', async () => {
  const store = await vite.ssrLoadModule('/src/services/offline/store.ts');
  const cache = await vite.ssrLoadModule('/src/services/offline/readCache.ts');
  const outbox = await vite.ssrLoadModule('/src/services/offline/outbox.ts');
  store.setOfflineStore(store.createMemoryStore());
  outbox.resetOutboxForTests();
  await cache.noteAccount('pro-a');
  await outbox.loadOutbox('pro-a');
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  await openEvaluationForm();
  await editField('Cintura', '80');
  evaluationResponder = () =>
    json(
      {
        error: {
          code: 'EVALUATION_UPGRADE_REQUIRED',
          message: 'El registro requiere una migración autorizada.',
        },
      },
      503
    );
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.match(document.body.textContent, /Migración pendiente/);
  assert.match(document.body.textContent, /No se guardó ni se encoló/);
  assert.equal(outbox.getOperations().length, 0);
  assert.equal(field('Cintura').value, '80');
  assert.doesNotMatch(
    document.body.textContent,
    /El servidor confirmó la persistencia/
  );
});

test('HU-021 pending HTTP submission blocks double send and preserves capture on business error', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  await openEvaluationForm();
  await editField('Cintura', '80');
  let finish;
  evaluationResponder = () =>
    new Promise((done) => {
      finish = done;
    });
  const form = document.querySelector('form');
  await act(async () => {
    form.dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    form.dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
  });
  assert.equal(
    requests.filter(
      (r) => r.method === 'POST' && r.url.endsWith('/evaluations')
    ).length,
    1
  );
  assert.ok(
    document.querySelector('progress[aria-label="Guardando evaluación"]')
  );
  assert.equal(button('Guardando…').disabled, true);
  await act(async () =>
    finish(
      json(
        {
          error: {
            code: 'EVALUATION_FORBIDDEN',
            message: 'No se permite registrar.',
          },
        },
        403
      )
    )
  );
  assert.equal(field('Cintura').value, '80');
  assert.match(document.body.textContent, /No se permite registrar/);
  assert.equal(button('Guardar evaluación').disabled, false);
});

test('HU-021 leaving capture requires confirmation and cancellation keeps method drafts', async () => {
  composedResponder = () => composed({ ...editableRecord, id: 'record-a' });
  await openComposedRecord('record-a');
  await openEvaluationForm();
  await editField('Cintura', '80');
  const confirm = await vite.ssrLoadModule('/src/services/confirm.ts');
  const back = () =>
    [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'Volver a Evaluación'
    );
  try {
    confirm.setConfirmHandler(async () => false);
    await act(async () => back().click());
    assert.match(window.location.pathname, /\/nueva$/);
    assert.equal(field('Cintura').value, '80');
    confirm.setConfirmHandler(async () => true);
    await act(async () => back().click());
    assert.equal(window.location.pathname, '/app/clientes/record-a/evaluacion');
  } finally {
    confirm.setConfirmHandler(null);
  }
});

test('HU-021 StrictMode effect replay still handles server confirmation and exits saving', async () => {
  const { default: Form } = await vite.ssrLoadModule(
    '/src/features/evaluations/components/AssessmentForm.tsx'
  );
  let confirmed = 0;
  await act(async () =>
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Form, {
          clientId: 'record-a',
          clientName: 'Client QA',
          onSaved: () => {
            confirmed++;
          },
          onQueued: () => {
            throw Error('Unexpected queue');
          },
        })
      )
    )
  );
  await editField('Cintura', '80');
  evaluationResponder = () =>
    json(
      {
        evaluation: {
          id: 'strict-evaluation',
          clientId: 'record-a',
          evaluationDate: '2026-11-10',
          createdAt: '2026-11-10T12:00:00.000Z',
          weightKg: null,
          waistCm: 80,
          hipCm: null,
          measuredBodyFatPercentage: null,
          pectoralSkinfoldMm: null,
          abdominalSkinfoldMm: null,
          tricepsSkinfoldMm: null,
          suprailiacSkinfoldMm: null,
          thighSkinfoldMm: null,
        },
      },
      201
    );
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.equal(confirmed, 1);
  assert.match(
    document.body.textContent,
    /El servidor confirmó la persistencia/
  );
  assert.equal(document.querySelector('progress'), null);
  assert.equal(button('Guardando…'), undefined);
});

test('HU-021 old client URLs redirect to record evaluation and capture without selecting another client', async () => {
  const id = '12345678-1234-4234-8234-123456789012';
  composedResponder = () => composed({ ...editableRecord, id });
  for (const suffix of ['', '/nueva']) {
    await act(async () => {
      window.history.pushState(
        {},
        '',
        `/app/evaluaciones/${id}${suffix}?return=https://example.invalid`
      );
      window.dispatchEvent(new window.PopStateEvent('popstate'));
    });
    assert.equal(
      window.location.pathname,
      `/app/clientes/${id}/evaluacion${suffix}`
    );
    assert.equal(window.location.search, '');
    assert.equal(
      document
        .querySelector(
          'nav[aria-label="Secciones del cliente"] a[aria-current="page"]'
        )
        .textContent.trim(),
      'Evaluación'
    );
    if (suffix)
      assert.ok(
        document.querySelector(
          'form[aria-label="Registrar evaluación antropométrica"]'
        )
      );
    else {
      assert.equal(
        document.querySelector('select[aria-label="Cliente"]'),
        null
      );
      assert.doesNotMatch(document.body.textContent, /Selecciona un cliente/);
    }
  }
  assert.equal(writes().length, 0);
});

test('HU-021 legacy global and malformed client URLs redirect to Clients without a guessed identity', async () => {
  for (const path of [
    '/app/evaluaciones',
    '/app/evaluaciones/not-a-valid-id',
    '/app/evaluaciones/%2Fmalformed/nueva',
  ]) {
    await act(async () => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new window.PopStateEvent('popstate'));
    });
    assert.equal(window.location.pathname, '/app/clientes');
    assert.equal(
      document.querySelector(
        'form[aria-label="Registrar evaluación antropométrica"]'
      ),
      null
    );
  }
  assert.equal(
    requests.some((r) => r.url.endsWith('/record')),
    false
  );
});

test('HU-021 foreign record evaluation does not reveal a form or a client selector', async () => {
  composedResponder = () => json({ error: { code: 'CLIENT_NOT_FOUND' } }, 404);
  await act(async () => {
    window.history.pushState({}, '', '/app/clientes/foreign/evaluacion/nueva');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  });
  assert.match(
    document.body.textContent,
    /No pudimos consultar este expediente/
  );
  assert.equal(
    document.querySelector(
      'form[aria-label="Registrar evaluación antropométrica"]'
    ),
    null
  );
  assert.equal(document.querySelector('select[aria-label="Cliente"]'), null);
  assert.doesNotMatch(document.body.textContent, /Selecciona un cliente/);
  assert.equal(writes().length, 0);
});

test('HU-021 shared client tabs preserve Summary and Training navigation and return to the same evaluation', async () => {
  composedResponder = () =>
    composed({ ...editableRecord, id: 'record-a', goal: 'Original goal' });
  await openComposedRecord('record-a');
  const tab = (label) =>
    [
      ...document.querySelectorAll('nav[aria-label="Secciones del cliente"] a'),
    ].find((a) => a.textContent.trim() === label);
  await act(async () => tab('Entrenamiento').click());
  assert.equal(
    window.location.pathname,
    '/app/clientes/record-a/entrenamiento'
  );
  assert.equal(tab('Entrenamiento').getAttribute('aria-current'), 'page');
  assert.ok(
    document.querySelector('[aria-label="Secciones de entrenamiento"]')
  );
  await act(async () => tab('Evaluación').click());
  assert.equal(window.location.pathname, '/app/clientes/record-a/evaluacion');
  assert.equal(tab('Evaluación').getAttribute('aria-current'), 'page');
  await act(async () => tab('Resumen').click());
  assert.equal(window.location.pathname, '/app/clientes/record-a');
  assert.match(document.body.textContent, /Original goal/);
  assert.equal(writes().length, 0);
});

test('HU-021 inactive client keeps the evaluation tab/history but cannot open a capture form', async () => {
  composedResponder = () =>
    composed({ ...editableRecord, id: 'record-a', status: 'inactive' });
  await act(async () => {
    window.history.pushState({}, '', '/app/clientes/record-a/evaluacion/nueva');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  });
  assert.match(document.body.textContent, /expediente está inactivo/);
  assert.equal(document.querySelector('form'), null);
  assert.equal(
    document
      .querySelector(
        'nav[aria-label="Secciones del cliente"] a[aria-current="page"]'
      )
      .textContent.trim(),
    'Evaluación'
  );
  assert.equal(writes().length, 0);
});

// HU-022 stage 2: contract compatibility only; no evolution table/chart yet.
async function evolutionFixture() {
  const { measurementFields } = await vite.ssrLoadModule(
    '/src/features/evaluations/types/assessment.ts'
  );
  const id = '20000000-0000-4000-8000-000000000002';
  const sample = {
    id: '30000000-0000-4000-8000-000000000003',
    clientId: id,
    date: '2026-11-10',
    dateBasis: 'legacy_evaluation_date',
    createdAt: '2026-11-11T00:00:00.123456Z',
    source: 'professional_evaluation',
    method: null,
    provenance: null,
    protocol: null,
    measurements: { weightKg: 80.1 },
  };
  return {
    clientId: id,
    period: { from: null, to: null },
    method: null,
    order: 'asc',
    metricDefinitions: Object.fromEntries(
      Object.entries(measurementFields).map(([key, meta]) => [
        key,
        { label: meta[0], unit: meta[1], decimalPlaces: 1 },
      ])
    ),
    samples: [sample],
    pageInfo: { pageSize: 20, hasMore: false, nextCursor: null },
  };
}

test('HU-022 available progress contract is accepted by the existing record without breaking Summary/Training/Evaluation', async () => {
  const history = await evolutionFixture();
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      { ...unavailableSections(), progress: { status: 'available', history } }
    );
  await openComposedRecord(history.clientId);
  assert.match(
    document.body.textContent,
    /Hay evaluaciones disponibles para consultar su evolución/
  );
  assert.doesNotMatch(document.body.textContent, /No pudimos interpretar/);
  assert.deepEqual(
    [
      ...document.querySelectorAll('nav[aria-label="Secciones del cliente"] a'),
    ].map((a) => a.textContent.trim()),
    ['Resumen', 'Entrenamiento', 'Evaluación']
  );
  assert.equal(writes().length, 0);
});

test('HU-022 empty/error progress payloads preserve state semantics and old cached not_integrated remains compatible', async () => {
  const history = await evolutionFixture();
  history.samples = [];
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      { ...unavailableSections(), progress: { status: 'empty', history } }
    );
  await openComposedRecord(history.clientId);
  assert.match(
    document.body.textContent,
    /Sin evaluaciones confirmadas en el expediente consultado/
  );
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      {
        ...unavailableSections(),
        progress: { status: 'error', code: 'QUERY_FAILED' },
      }
    );
  await openComposedRecord('temporary-switch');
  await openComposedRecord(history.clientId);
  assert.match(
    document.body.textContent,
    /No pudimos consultar el resumen de evolución/
  );
  assert.equal(writes().length, 0);
});

test('HU-022 Web rejects foreign samples, broken page metadata, invalid provenance and malformed record progress', async () => {
  const { isEvolutionPage } = await vite.ssrLoadModule(
    '/src/features/evaluations/types/evolution.ts'
  );
  const history = await evolutionFixture();
  assert(isEvolutionPage(history, history.clientId));
  for (const change of [
    (p) => {
      p.samples[0].clientId = '40000000-0000-4000-8000-000000000004';
    },
    (p) => {
      p.samples[0].measurements.weightKg = null;
    },
    (p) => {
      p.samples[0].measurements.constructor = 2;
    },
    (p) => {
      p.samples[0].method = 'perimetros';
    },
    (p) => {
      p.method = ['legacy'];
    },
    (p) => {
      p.pageInfo.hasMore = true;
    },
    (p) => {
      p.period.from = '2026-02-30';
    },
    (p) => {
      p.samples.push({ ...p.samples[0] });
    },
  ]) {
    const p = structuredClone(history);
    change(p);
    assert.equal(isEvolutionPage(p, history.clientId), false);
  }
  history.samples[0].clientId = '40000000-0000-4000-8000-000000000004';
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      { ...unavailableSections(), progress: { status: 'available', history } }
    );
  await openComposedRecord(history.clientId);
  assert.doesNotMatch(
    document.body.textContent,
    /Hay evaluaciones disponibles/
  );
  assert.equal(writes().length, 0);
});

test('HU-022 an empty progress envelope without its authorized history is rejected, not treated as no data', async () => {
  const history = await evolutionFixture();
  const { fetchProfessionalRecord } = await vite.ssrLoadModule(
    '/src/features/professional/services/record.ts'
  );
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      { ...unavailableSections(), progress: { status: 'empty' } }
    );
  await assert.rejects(
    () => fetchProfessionalRecord(history.clientId),
    /Invalid evolution section/
  );
  assert.equal(writes().length, 0);
});

test('HU-022 Summary opens evolution inside the same client Evaluation tab and preserves HU-021 capture', async () => {
  const history = await evolutionFixture();
  historyResponder = () => json(history);
  composedResponder = () =>
    composed(
      { ...editableRecord, id: history.clientId },
      { ...unavailableSections(), progress: { status: 'available', history } }
    );
  await openComposedRecord(history.clientId);
  await act(async () =>
    [...document.querySelectorAll('a')]
      .find((a) => a.textContent === 'Ver evolución')
      .click()
  );
  assert.equal(
    window.location.pathname,
    `/app/clientes/${history.clientId}/evaluacion`
  );
  assert.equal(window.location.hash, '#evolucion-antropometrica');
  assert.match(document.body.textContent, /Evolución antropométrica/);
  assert.match(document.querySelector('table').textContent, /80.1/);
  assert.equal(document.querySelector('a[href="/app/evaluaciones"]'), null);
  assert.equal(writes().length, 0);
  await openEvaluationForm();
  assert.match(document.body.textContent, /Nueva evaluación antropométrica/);
  assert.equal(document.querySelector('#evolucion-antropometrica'), null);
});
