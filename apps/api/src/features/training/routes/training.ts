import { Router, json } from 'express'
import type { Pool } from 'pg'
import { requireClient, requireProfessional } from '../../auth/middleware/session.js'
import { bearerToken, requireCsrf } from '../../auth/middleware/session-http.js'
import { trainingControllers } from '../controllers/training.js'

export function trainingRoutes(pool: Pool, now?: () => Date) {
  const router=Router(),controller=trainingControllers(pool,now??(()=>new Date()))
  const pro=requireProfessional(pool,now),client=requireClient(pool,now)
  // Parse only training writes with the larger bound; auth keeps its existing limit.
  const payload=json({limit:'1mb'})
  router.get('/training/exercises',pro,controller.catalog)
  router.get('/training/clients',pro,controller.clients)
  for(const path of ['/training/templates','/clients/:clientId/training-plans']){
    router.get(path,pro,controller.versions)
    router.post(path,pro,requireCsrf,payload,controller.write)
    router.post(`${path}/:planId/versions`,pro,requireCsrf,payload,controller.write)
    router.patch(`${path}/:planId/versions/:versionId`,pro,requireCsrf,payload,controller.write)
  }
  router.post('/clients/:clientId/training-plans/:planId/versions/:versionId/activate',pro,requireCsrf,payload,controller.activate)
  router.patch('/clients/:clientId/training-time-zone',pro,requireCsrf,payload,controller.zone)
  router.get('/clients/:clientId/training-sessions',pro,controller.sessions)
  router.get('/me/training-plan',client,controller.plan)
  router.get('/me/training-sessions/context',client,controller.context)
  router.post('/me/training-sessions',client,(req,res,next)=>bearerToken(req)!==undefined?next():requireCsrf(req,res,next),payload,controller.saveSession)
  return router
}
