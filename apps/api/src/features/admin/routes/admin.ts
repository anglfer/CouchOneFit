import { Router } from 'express'
import type { Pool } from 'pg'
import { sessionController } from '../../auth/controllers/session.js'
import { requireAdmin } from '../../auth/middleware/session.js'
import { plansController } from '../controllers/plans.js'
import { 
  adminProfessionalsController,
  updateSubscriptionController as adminUpdateSubscriptionController
} from '../controllers/professionals.js'
import { 
  generateInvitationController, 
  getClientAccessListController,
  getClientInvitationController 
} from '../controllers/clientAccess.js'

export function adminRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  }, requireAdmin(pool, now))

  router.get('/session', sessionController)

  // Gestión del catálogo de planes SaaS (HU-010)
  const plans = plansController(pool)
  router.get('/plans', plans.list)
  router.post('/plans', plans.create)
  router.put('/plans/:id', plans.update)

  // Directorio y suscripciones de profesionales (HU-012 / HU-014)
  router.get('/professionals', adminProfessionalsController(pool))
  router.patch('/professionals/:id/subscription', adminUpdateSubscriptionController(pool))

  // Módulo de Acceso a expedientes e invitaciones (HU-011 / HU-013)
  router.get('/client-access', getClientAccessListController(pool))
  router.post('/client-access/invite', generateInvitationController(pool))

  // Endpoints consumidos de forma individual por el cliente/expediente
  router.get('/clients/:id/invitations', getClientInvitationController(pool))
  router.post('/clients/:id/invitations', generateInvitationController(pool))

  return router
}