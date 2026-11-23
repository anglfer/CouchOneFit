import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// DEC-018 §2.1: activar/inactivar un expediente entra en la cola sin conexión.
let dom, vite, StatusAction, outbox, root;
const clientId = 'c1';

before(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/' });
  for (const key of ['window', 'document', 'navigator', 'localStorage'])
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const load = (path) => vite.ssrLoadModule(path);
  StatusAction = (
    await load('/src/features/professional/components/ClientStatusAction.tsx')
  ).default;
  const store = await load('/src/services/offline/store.ts');
  const cache = await load('/src/services/offline/readCache.ts');
  outbox = await load('/src/services/offline/outbox.ts');
  store.setOfflineStore(store.createMemoryStore());
  await cache.noteAccount('pro-a');
  await outbox.loadOutbox('pro-a');
  // Solo se abrió la ficha antes de perder la conexión.
  await cache.rememberRead(`/api/clients/${clientId}/record`, {
    record: {
      profile: { id: clientId, fullName: 'Ana', status: 'active', version: 3 },
      sections: {
        nutritionPlan: { status: 'not_integrated' },
        trainingPlan: { status: 'not_integrated' },
        evaluations: { status: 'empty' },
        progress: { status: 'not_integrated' },
        bodyWeightHistory: { status: 'not_integrated' },
      },
    },
  });
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
});

after(async () => {
  if (root) await act(async () => root.unmount());
  await vite?.close();
  dom?.window.close();
});

test('sin conexión, inactivar usa la ficha guardada y queda en cola con su versión', async () => {
  let queued = false;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      React.createElement(StatusAction, {
        clientId,
        status: 'active',
        accountId: 'pro-a',
        sessionReady: true,
        onChanged: () => undefined,
        onQueued: () => {
          queued = true;
        },
      })
    )
  );
  const click = async (label) => {
    await act(async () =>
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent === label)
        .click()
    );
    // La lectura guardada se descifra de forma asíncrona.
    for (let i = 0; i < 20; i++)
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  };
  await click('Inactivar expediente');
  assert.match(document.body.textContent, /Estado consultado: Activo/);
  await click('Confirmar inactivación');
  assert.equal(queued, true);
  const [operation] = outbox.getOperations();
  assert.equal(operation.kind, 'client.status');
  assert.deepEqual(operation.body, { status: 'inactive', version: 3 });
});
