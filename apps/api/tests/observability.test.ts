import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { config } from '../src/config/index.js'
import { configureLogger } from '../src/shared/utils/logger.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cof-observability-'))
const pool = new Pool({
  connectionString: 'postgresql://invalid:invalid@127.0.0.1:9/none',
  connectionTimeoutMillis: 500,
})
const app = createApp(pool)
type Line = Record<string, any>

function file(): string {
  return path.join(dir, `api-${new Date().toISOString().slice(0, 10)}.jsonl`)
}
function lines(): Line[] {
  if (!fs.existsSync(file())) return []
  return fs
    .readFileSync(file(), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Line)
}
async function waitFor(predicate: () => boolean, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Tiempo de espera agotado')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('observability', () => {
  before(() => configureLogger({ dir, level: 'debug' }))
  after(async () => {
    configureLogger({ level: 'silent', dir: null })
    await pool.end()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('logs a successful request with a correlation id', async () => {
    const res = await request(app).get('/api/health').expect(200)
    const id = res.headers['x-request-id']
    assert.ok(id)
    await waitFor(() => lines().some((l) => l.requestId === id))
    const line = lines().find(
      (l) => l.event === 'http.request' && l.requestId === id
    )!
    assert.equal(line.level, 'INFO')
    assert.equal(line.status, 200)
    assert.equal(line.path, '/api/health')
    assert.equal(line.outcome, 'success')
    assert.equal(typeof line.durationMs, 'number')
  })

  it('propagates a valid request id and replaces an invalid one', async () => {
    const valid = randomUUID()
    const ok = await request(app)
      .get('/api/health')
      .set('X-Request-Id', valid)
      .expect(200)
    assert.equal(ok.headers['x-request-id'], valid)
    await waitFor(() => lines().some((l) => l.requestId === valid))
    const bad = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'opaque-credential-1234')
      .expect(200)
    assert.notEqual(bad.headers['x-request-id'], 'opaque-credential-1234')
    assert.match(bad.headers['x-request-id'], /^[0-9a-f-]{36}$/)
  })

  it('records declared paths without personal values from route parameters or unknown paths', async () => {
    const matched = await request(app)
      .get('/api/clients/private-identifier/training-plans?value=private-query')
      .expect(401)
    const missing = await request(app)
      .get('/api/private-missing/path')
      .expect(404)
    const matchedId = matched.headers['x-request-id']
    const missingId = missing.headers['x-request-id']
    await waitFor(() => lines().some((l) => l.requestId === missingId))

    const records = lines().filter((l) => [matchedId, missingId].includes(l.requestId))
    assert.equal(records.find((l) => l.event === 'auth.denied')?.path, '/api/clients/:id/training-plans')
    assert.equal(records.find((l) => l.requestId === missingId)?.path, '/api/:unmatched')
    assert.doesNotMatch(JSON.stringify(records), /private-identifier|private-query|private-missing/)
  })

  it('labels only requests authenticated by the monitor as synthetic', async () => {
    const originalSecret = config.observabilityIngestSecret
    const secret = randomUUID()
    config.observabilityIngestSecret = secret
    try {
      const verified = await request(app)
        .get('/api/health')
        .set('X-Observability-Token', secret)
        .expect(200)
      const unverified = await request(app)
        .get('/api/health')
        .set('X-Observability-Token', 'unverified')
        .expect(200)
      const verifiedId = verified.headers['x-request-id']
      const unverifiedId = unverified.headers['x-request-id']
      await waitFor(() => lines().some((l) => l.requestId === unverifiedId))
      assert.equal(lines().find((l) => l.requestId === verifiedId)?.synthetic, true)
      assert.equal(lines().find((l) => l.requestId === unverifiedId)?.synthetic, undefined)
    } finally {
      config.observabilityIngestSecret = originalSecret
    }
  })

  it('logs timed-out database operations with a sanitized cause', async () => {
    const timeoutPool = new Pool()
    timeoutPool.query = (() => Promise.reject(Object.assign(
      new Error('connection timed out with embedded-secret-value'),
      { code: 'ETIMEDOUT' },
    ))) as typeof timeoutPool.query
    try {
      const response = await request(createApp(timeoutPool)).get('/api/health/ready').expect(503)
      const id = response.headers['x-request-id']
      await waitFor(() => lines().some((l) => l.event === 'db.connection_error' && l.requestId === id))
      const failure = lines().find((l) => l.event === 'db.connection_error' && l.requestId === id)
      assert.equal(failure?.errorCode, 'ETIMEDOUT')
      assert.equal(failure?.outcome, 'timeout')
      assert.doesNotMatch(JSON.stringify(failure), /embedded-secret-value/)
    } finally {
      await timeoutPool.end()
    }
  })

  it('reports database outage in readiness and structured logs', async () => {
    const ready = await request(app).get('/api/health/ready').expect(503)
    assert.equal(ready.body.status, 'unavailable')
    assert.equal(ready.body.database, 'unavailable')
    assert.ok(!JSON.stringify(ready.body).includes('timeout'))

    const plans = await request(app).get('/api/plans').expect(503)
    assert.equal(plans.body.error.code, 'SERVICE_UNAVAILABLE')
    assert.equal(plans.body.error.message, 'No pudimos completar la solicitud.')
    const id = plans.headers['x-request-id']
    await waitFor(() =>
      lines().some((l) => l.event === 'http.request' && l.requestId === id)
    )
    const all = lines()
    const dbLine = all.find(
      (l) => l.event === 'db.connection_error' && l.requestId === id
    )
    assert.ok(dbLine)
    assert.equal(dbLine.level, 'ERROR')
    assert.equal(dbLine.status, 503)
    const http = all.find((l) => l.event === 'http.request' && l.requestId === id)!
    assert.equal(http.outcome, 'server_error')
    assert.equal(http.level, 'ERROR')
  })

  it('never writes credentials to the log', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'persona@example.com', contrasena: 'Secreta-123!' })
    const id = res.headers['x-request-id']
    await waitFor(() =>
      lines().some((l) => l.event === 'http.request' && l.requestId === id)
    )
    const raw = fs.readFileSync(file(), 'utf8')
    assert.ok(!raw.includes('Secreta-123!'))
    assert.ok(!raw.includes('persona@example.com'))
  })

  it('logs malformed JSON as body_error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400)
    assert.equal(res.body.error.code, 'INVALID_JSON')
    const id = res.headers['x-request-id']
    await waitFor(() =>
      lines().some((l) => l.event === 'http.body_error' && l.requestId === id)
    )
    const line = lines().find(
      (l) => l.event === 'http.body_error' && l.requestId === id
    )!
    assert.equal(line.level, 'WARN')
    assert.equal(line.errorType, 'entity.parse.failed')
  })

  it('logs an aborted upload', async () => {
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    const marker = randomUUID()
    const socket = net.connect(port, '127.0.0.1')
    await new Promise((resolve) => socket.once('connect', resolve))
    socket.write(
      'POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\n' +
        `X-Request-Id: ${marker}\r\n` +
        'Content-Type: application/json\r\nContent-Length: 1000\r\n\r\n{"em'
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    socket.destroy()
    try {
      await waitFor(() =>
        lines().some(
          (l) =>
            l.requestId === marker &&
            (l.event === 'http.aborted' ||
              (l.event === 'http.body_error' &&
                l.errorType === 'request.aborted'))
        )
      )
    } finally {
      server.close()
      server.closeAllConnections()
    }
    assert.ok(lines().some((l) => l.requestId === marker))
  })
})
