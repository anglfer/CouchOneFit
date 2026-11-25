import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'
import type { Pool } from 'pg'
import { DatabaseLogSink } from '../src/features/observability/services/log-sink.js'
import { configureLogger, logger } from '../src/shared/utils/logger.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cof-logger-'))
let counter = 0
let dir = ''
const today = () => new Date().toISOString().slice(0, 10)

function lines(): Record<string, unknown>[] {
  const file = path.join(dir, `api-${today()}.jsonl`)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

describe('logger', () => {
  beforeEach(() => {
    dir = path.join(root, `case-${counter++}`)
  })
  after(() => {
    configureLogger({ level: 'silent', dir: null })
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('filters by level', () => {
    configureLogger({ dir, level: 'warn' })
    logger.debug('a.debug')
    logger.info('a.info')
    logger.warn('a.warn')
    logger.error('a.error')
    assert.deepEqual(
      lines().map((l) => l.event),
      ['a.warn', 'a.error']
    )
  })

  it('writes the JSONL record contract', () => {
    configureLogger({ dir, level: 'debug' })
    logger.info('shape.check', { requestId: 'abc', status: 200 })
    const [line] = lines()
    assert.equal(line.level, 'INFO')
    assert.equal(line.service, 'api')
    assert.equal(line.event, 'shape.check')
    assert.match(String(line.id), /^[0-9a-f-]{36}$/)
    assert.equal(line.env, process.env.NODE_ENV || 'development')
    assert.equal(line.status, 200)
    assert.equal(new Date(line.ts as string).toISOString(), line.ts)
  })

  it('redacts sensitive keys recursively and keeps safe ones', () => {
    configureLogger({ dir, level: 'debug' })
    logger.error('redact.check', {
      errorCode: '23505',
      errorName: 'DatabaseError',
      event: 'ignored',
      password: 'p1',
      nested: {
        contrasena: 'p2',
        list: [{ token: 't1 ', email: 'a@b.co' }],
        cookie: 'c1',
        ok: 'visible',
      },
      err: new Error('boom'),
    })
    const raw = fs.readFileSync(path.join(dir, `api-${today()}.jsonl`), 'utf8')
    for (const secret of ['p1', 'p2', 't1', 'a@b.co', 'c1'])
      assert.ok(!raw.includes(`"${secret.trim()}`) && !raw.includes(secret.trim() + '"'))
    const [line] = lines()
    assert.equal(line.event, 'redact.check')
    assert.equal(line.errorCode, '23505')
    assert.equal(line.errorName, 'DatabaseError')
    assert.equal(line.password, '[REDACTED]')
    const nested = line.nested as Record<string, any>
    assert.equal(nested.contrasena, '[REDACTED]')
    assert.equal(nested.list[0].token, '[REDACTED]')
    assert.equal(nested.list[0].email, '[REDACTED]')
    assert.equal(nested.cookie, '[REDACTED]')
    assert.equal(nested.ok, 'visible')
    assert.deepEqual(line.err, { name: 'Error', message: 'boom' })
  })

  it('truncates long strings', () => {
    configureLogger({ dir, level: 'debug' })
    logger.info('long', { message: 'x'.repeat(5000) })
    assert.equal((lines()[0].message as string).length, 2000)
  })

  it('removes old dated files and keeps today', () => {
    fs.mkdirSync(dir, { recursive: true })
    const old = path.join(dir, 'api-2000-01-01.jsonl')
    const unrelated = path.join(dir, 'notes.txt')
    fs.writeFileSync(old, '{}\n')
    fs.writeFileSync(unrelated, 'keep')
    configureLogger({ dir, level: 'debug', retentionDays: 14 })
    logger.info('retention.check')
    assert.equal(fs.existsSync(old), false)
    assert.equal(fs.existsSync(unrelated), true)
    assert.equal(lines().length, 1)
  })

  it('never throws when the sink fails', () => {
    const blocker = path.join(root, 'is-a-file')
    fs.writeFileSync(blocker, 'x')
    configureLogger({ dir: path.join(blocker, 'sub'), level: 'debug' })
    assert.doesNotThrow(() => {
      logger.error('sink.fail')
      logger.error('sink.fail.again')
    })
  })

  it('persists only one recovery event after repeated database failures', async (context) => {
    let now = 100_000
    context.mock.method(Date, 'now', () => now)
    const successfulWrites: Array<Record<string, unknown>> = []
    let attempts = 0
    const pool = {
      query: async (_sql: string, [payload]: [string]) => {
        if (++attempts < 3) throw new Error('Base de pruebas desconectada')
        successfulWrites.push(...JSON.parse(payload))
      },
    } as unknown as Pool
    const sink = new DatabaseLogSink(pool)
    try {
      sink.enqueue({ event: 'http.request', outcome: 'success' })
      await sink.flush()
      now += 5000
      await sink.flush()
      now += 10_000
      await sink.flush()
      assert.deepEqual(successfulWrites.map((entry) => entry.eventType), [
        'http.request',
        'system.recovery',
      ])
    } finally {
      await sink.close()
    }
  })
})
