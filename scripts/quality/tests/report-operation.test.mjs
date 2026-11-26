import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportOperation } from '../report-operation.mjs';

function mockFetch(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

const base = {
  apiUrl: 'https://api.example.test',
  token: 'secret-token',
  kind: 'backup',
  externalId: 'backup-1-1',
  occurredAt: '2026-12-01T09:00:00Z',
};

test('posts the record with token header and merges ok into details', async () => {
  const { calls, fetchImpl } = mockFetch(201, { duplicate: false });
  const result = await reportOperation({
    ...base,
    ok: false,
    details: { sizeBytes: 12 },
    fetchImpl,
  });
  assert.deepEqual(result, { duplicate: false });
  assert.equal(calls[0].url, 'https://api.example.test/api/observability/operations');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-Observability-Token'], 'secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    environment: 'production',
    kind: 'backup',
    occurredAt: '2026-12-01T09:00:00.000Z',
    externalId: 'backup-1-1',
    details: { sizeBytes: 12, ok: false },
  });
  assert.ok(!calls[0].init.body.includes('secret-token'));
});

test('treats 200 duplicate as success', async () => {
  const { fetchImpl } = mockFetch(200, { duplicate: true });
  assert.deepEqual(await reportOperation({ ...base, fetchImpl }), {
    duplicate: true,
  });
});

test('fails on HTTP errors without leaking the token', async () => {
  const { fetchImpl } = mockFetch(401, { error: { code: 'UNAUTHORIZED' } });
  await assert.rejects(
    reportOperation({ ...base, fetchImpl }),
    (error) =>
      /HTTP 401/.test(error.message) && !error.message.includes('secret-token'),
  );
});

test('fails on network errors and timeouts', async () => {
  const timeout = async () => {
    throw Object.assign(new Error('x'), { name: 'TimeoutError' });
  };
  await assert.rejects(
    reportOperation({ ...base, fetchImpl: timeout }),
    /Tiempo de espera/,
  );
  const network = async () => {
    throw new Error('secret-token boom');
  };
  await assert.rejects(
    reportOperation({ ...base, fetchImpl: network }),
    (error) => !error.message.includes('secret-token'),
  );
});

test('validates inputs before calling the API', async () => {
  const { calls, fetchImpl } = mockFetch(201, {});
  const invalid = [
    { kind: 'nope' },
    { environment: 'prod' },
    { externalId: '' },
    { occurredAt: 'yesterday' },
    { token: '' },
    { apiUrl: 'http://example.test' },
    { apiUrl: 'https://user:pass@api.example.test' },
    { details: [] },
  ];
  for (const override of invalid) {
    await assert.rejects(
      reportOperation({ ...base, ...override, fetchImpl }),
      (error) => !error.message.includes('pass@'),
      JSON.stringify(Object.keys(override)),
    );
  }
  assert.equal(calls.length, 0);
});
