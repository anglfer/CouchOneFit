import { Router, json } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { observabilityAdminControllers } from '../controllers/observability.js'

export function adminObservabilityRoutes(
  pool: Pool,
  now?: () => Date,
): Router {
  const router = Router()
  const c = observabilityAdminControllers(pool, now)
  const payload = json({ limit: '64kb' })
  const runChecksLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 15,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message:
          'Demasiadas ejecuciones manuales de comprobaciones. Espera unos minutos.',
      },
    },
  })

  router.get('/dashboard', c.dashboard)
  router.get('/logs/export', c.exportLogs)
  router.get('/logs/:id', c.logDetail)
  router.get('/logs', c.logs)

  router.get('/slis', c.listSlis)
  router.post('/slis', requireCsrf, payload, c.createSli)
  router.put('/slis/:id', requireCsrf, payload, c.updateSli)
  router.patch('/slis/:id/status', requireCsrf, payload, c.toggleSliStatus)
  router.get('/slis/:id/versions', c.sliVersions)

  router.get('/slos', c.listSlos)
  router.post('/slos', requireCsrf, payload, c.createSlo)
  router.put('/slos/:id', requireCsrf, payload, c.updateSlo)
  router.patch('/slos/:id/status', requireCsrf, payload, c.toggleSloStatus)
  router.post('/slos/evaluate', requireCsrf, payload, c.evaluateSlos)
  router.get('/slos/:id/history', c.sloHistory)

  router.get('/slas', c.listSlas)
  router.post('/slas', requireCsrf, payload, c.createSla)
  router.put('/slas/:id', requireCsrf, payload, c.updateSla)
  router.patch('/slas/:id/status', requireCsrf, payload, c.toggleSlaStatus)

  router.get('/checks', c.checksOverview)
  router.post(
    '/checks/run',
    runChecksLimiter,
    requireCsrf,
    payload,
    c.runChecks,
  )
  router.put('/settings', requireCsrf, payload, c.updateSettings)
  router.post('/maintenance/prune', requireCsrf, payload, c.pruneMaintenance)

  router.get('/incidents', c.listIncidents)
  router.patch('/incidents/:id', requireCsrf, payload, c.updateIncident)

  router.get('/reports', c.report)
  router.get('/audit', c.audit)

  return router
}
