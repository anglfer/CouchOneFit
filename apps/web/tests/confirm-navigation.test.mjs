import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// Confirmaciones dentro de la app (sin window.confirm) y guardia de
// navegación que espera la respuesta del diálogo.
let vite, confirm, navigation;
const start = 'http://localhost/app/clientes/a/entrenamiento';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const ask = () => {
  let answer;
  const question = new Promise((resolve) => (answer = resolve));
  return { question, answer: (ok) => answer(ok) };
};

before(async () => {
  const dom = new JSDOM('', { url: start });
  for (const key of ['window', 'document', 'PopStateEvent']) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  }
  dom.window.scrollTo = () => {};
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  confirm = await vite.ssrLoadModule('/src/services/confirm.ts');
  navigation = await vite.ssrLoadModule('/src/utils/navigation.ts');
});
after(async () => {
  await vite?.close();
});

test('sin diálogo montado nada se confirma: no se ejecuta a ciegas', async () => {
  confirm.setConfirmHandler(null);
  assert.equal(await confirm.confirmDialog({ title: '¿Quitar?' }), false);
});

test('la petición llega íntegra al diálogo y se respeta su respuesta', async () => {
  let seen;
  confirm.setConfirmHandler(async (request) => {
    seen = request;
    return true;
  });
  const request = { title: '¿Quitar?', message: 'Detalle', danger: true };
  assert.equal(await confirm.confirmDialog(request), true);
  assert.deepEqual(seen, request);
  confirm.setConfirmHandler(null);
});

test('la guardia asíncrona retiene la navegación hasta que se confirma', async () => {
  const first = ask();
  let guard = first.question;
  const release = navigation.guardNavigation(() => guard);

  navigation.navigate('/app/clientes');
  assert.equal(window.location.href, start, 'espera la respuesta');
  first.answer(false);
  await tick();
  assert.equal(window.location.href, start, 'cancelar no navega');

  const second = ask();
  guard = second.question;
  navigation.navigate('/app/clientes');
  second.answer(true);
  await tick();
  assert.equal(window.location.pathname, '/app/clientes');

  release();
  navigation.navigate('/app');
  assert.equal(window.location.pathname, '/app', 'sin guardia es inmediato');
});

test('atrás del navegador: se queda mientras pregunta y sale solo si se confirma', async () => {
  const here = window.location.href;
  const pending = ask();
  const release = navigation.guardNavigation(() => pending.question);

  window.history.pushState({}, '', '/app/rutinas');
  window.dispatchEvent(new PopStateEvent('popstate'));
  assert.equal(window.location.href, here, 'vuelve a la página actual');
  pending.answer(true);
  await tick();
  assert.equal(window.location.pathname, '/app/rutinas');
  release();
});
