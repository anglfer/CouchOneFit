import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// EP-06: tipo de serie (calentamiento, top set, drop set…) en la prescripción.
let vite, training;

before(async () => {
  const dom = new JSDOM('', { url: 'http://localhost/' });
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
  training = await vite.ssrLoadModule(
    '/src/features/training/services/training.ts'
  );
});
after(async () => {
  await vite?.close();
});

const set = (overrides = {}) => ({
  id: 's1',
  kind: 'working',
  reps: 8,
  repsMax: 12,
  rpe: null,
  rir: 2,
  targetLoadKg: null,
  ...overrides,
});
const version = (sets) => ({
  id: 'v1',
  planId: 'p1',
  clientId: null,
  number: 1,
  revision: 1,
  published: false,
  createdAt: '2026-11-05T00:00:00.000Z',
  name: 'Fuerza',
  schedule: 'cycle',
  startDate: '2026-11-05',
  days: [
    {
      id: 'd1',
      name: 'Día 1',
      kind: 'training',
      date: null,
      exercises: [
        {
          id: 'e1',
          catalogId: null,
          name: 'Press banca',
          instructions: '',
          guidance: [],
          images: [],
          loadMode: 'external',
          restSeconds: 120,
          sets,
        },
      ],
    },
  ],
});

test('accepts every gym set type and rejects unknown or missing ones', () => {
  for (const kind of Object.keys(training.SET_KINDS))
    assert.equal(training.isVersion(version([set({ kind })])), true, kind);
  assert.equal(training.isVersion(version([set({ kind: 'superset' })])), false);
  assert.equal(training.isVersion(version([set({ kind: 'toString' })])), false);
  const { kind: _omitted, ...legacy } = set();
  assert.equal(training.isVersion(version([legacy])), false);
});

test('labels non-working sets and keeps working sets unchanged', () => {
  assert.equal(training.setTarget(set()), '8–12 reps · RIR 2');
  assert.equal(
    training.setTarget(set({ kind: 'warmup', repsMax: null, rir: null })),
    'Calentamiento · 8 reps'
  );
  assert.equal(
    training.setTarget(set({ kind: 'top', targetLoadKg: 100, rir: 1 })),
    'Top set · 8–12 reps · RIR 1 · 100 kg'
  );
});
