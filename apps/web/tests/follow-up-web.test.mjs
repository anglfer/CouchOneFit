import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let followUp;
let recordService;

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  followUp = await vite.ssrLoadModule(
    '/src/features/follow-up/services/followUp.ts'
  );
  recordService = await vite.ssrLoadModule(
    '/src/features/professional/services/record.ts'
  );
});

after(async () => {
  await vite?.close();
});

const clientId = '33333333-3333-4333-8333-333333333333';
const summary = {
  applicableDays: 0,
  recordedDays: 0,
  completed: 0,
  partial: 0,
  notCompleted: 0,
  observedPercent: null,
  coveragePercent: null,
};
const weight = {
  checkInId: '44444444-4444-4444-8444-444444444444',
  localDate: '2026-11-20',
  timeZone: 'America/Mexico_City',
  weightKg: 71.2,
  unit: 'kg',
  source: 'check_in',
  revision: 1,
  recordedAt: '2026-11-20T14:00:00.000Z',
};
const checkIn = {
  id: weight.checkInId,
  localDate: '2026-11-20',
  timeZone: 'America/Mexico_City',
  revision: 1,
  bodyWeightKg: 71.2,
  sleepHours: 7.5,
  stress: 2,
  energy: 4,
  hunger: null,
  nutritionCompliance: 'partial',
  nutritionVersionId: null,
  comment: null,
  createdAt: weight.recordedAt,
  updatedAt: weight.recordedAt,
};

async function withResponse(body, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    withResponse.lastUrl = String(url);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('el seguimiento acepta datos reales y rechaza otra cartera o escalas inválidas', async () => {
  const body = {
    clientId,
    from: '2026-10-24',
    to: '2026-11-20',
    today: '2026-11-20',
    timeZone: 'America/Mexico_City',
    checkIns: [checkIn],
    bodyWeight: [weight],
    sessions: [],
    adherence: {
      training: summary,
      nutrition: {
        ...summary,
        applicableDays: 3,
        recordedDays: 1,
        partial: 1,
        observedPercent: 50,
        coveragePercent: 33,
      },
    },
    visibility: { measurements: false, adherence: true, revision: 1 },
  };
  await withResponse(body, async () => {
    const data = await followUp.fetchFollowUp(clientId, { days: 28 });
    assert.equal(data.bodyWeight[0].weightKg, 71.2);
    assert.match(withResponse.lastUrl, /\?days=28$/);
  });
  await withResponse(
    { ...body, clientId: '99999999-9999-4999-8999-999999999999' },
    () =>
      assert.rejects(() =>
        followUp.fetchFollowUp(clientId, { from: body.from, to: body.to })
      )
  );
  await withResponse({ ...body, checkIns: [{ ...checkIn, stress: 6 }] }, () =>
    assert.rejects(() => followUp.fetchFollowUp(clientId, { days: 28 }))
  );
  await withResponse({ ...body, bodyWeight: [{ ...weight, unit: 'lb' }] }, () =>
    assert.rejects(() => followUp.fetchFollowUp(clientId, { days: 28 }))
  );
  await withResponse(
    {
      days: 7,
      activeClients: 2,
      adherence: { training: summary, nutrition: summary },
    },
    async () => {
      const s = await followUp.fetchPortfolioSummary();
      assert.equal(s.activeClients, 2);
      assert.equal(s.adherence.training.observedPercent, null);
    }
  );
  await withResponse({ days: 7 }, () =>
    assert.rejects(() => followUp.fetchPortfolioSummary())
  );
});

test('sin denominador se muestra guion, nunca 0 %', () => {
  assert.equal(followUp.percentLabel(null), '—');
  assert.equal(followUp.percentLabel(0), '0 %');
  assert.equal(followUp.shiftDate('2026-03-01', -1), '2026-02-28');
});

test('el expediente integra el peso del check-in y rechaza entradas sin origen', async () => {
  const record = {
    record: {
      profile: {
        id: clientId,
        version: 1,
        fullName: 'Ana Prueba',
        status: 'active',
      },
      sections: {
        nutritionPlan: { status: 'empty' },
        trainingPlan: { status: 'empty' },
        evaluations: { status: 'empty' },
        progress: { status: 'not_integrated' },
        bodyWeightHistory: { status: 'available', entries: [weight] },
      },
    },
  };
  await withResponse(record, async () => {
    const read = await recordService.fetchProfessionalRecord(clientId);
    assert.equal(read.sections.bodyWeightHistory.entries[0].source, 'check_in');
    assert.equal(
      read.sections.bodyWeightHistory.entries[0].timeZone,
      'America/Mexico_City'
    );
  });
  record.record.sections.bodyWeightHistory.entries = [
    { ...weight, source: 'evaluation' },
  ];
  await withResponse(record, () =>
    assert.rejects(
      () => recordService.fetchProfessionalRecord(clientId),
      /Invalid body weight section/
    )
  );
  record.record.sections.bodyWeightHistory = {
    status: 'available',
    entries: [],
  };
  await withResponse(record, () =>
    assert.rejects(() => recordService.fetchProfessionalRecord(clientId))
  );
});
