import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import * as service from '../services/training.js'
import { uuid } from '../validators/training.js'

export function trainingControllers(pool: Pool, clock: () => Date) {
  const wrap=(action: (req: Parameters<RequestHandler>[0])=>Promise<unknown>):RequestHandler=>async(req,res,next)=>{
    try{res.set('Cache-Control','no-store');res.json(await action(req))}catch(error){next(error)}
  }
  const id=(value: unknown)=>value===undefined?null:uuid(value)
  return {
    catalog:wrap(req=>service.getCatalog(pool,req.identity!,req.query)),
    clients:wrap(req=>service.getClients(pool,req.identity!)),
    versions:wrap(req=>service.getVersions(pool,req.identity!,id(req.params.clientId))),
    write:wrap(req=>service.writePlan(pool,req.identity!,id(req.params.clientId),id(req.params.planId),id(req.params.versionId),req.get('Idempotency-Key'),req.body,clock())),
    activate:wrap(req=>service.activatePlan(pool,req.identity!,uuid(req.params.clientId),uuid(req.params.planId),uuid(req.params.versionId),req.get('Idempotency-Key'),req.body,clock())),
    plan:wrap(req=>service.getContext(pool,req.identity!,null,req.query,clock())),
    context:wrap(req=>service.getContext(pool,req.identity!,null,req.query,clock(),true)),
    saveSession:wrap(req=>service.saveSession(pool,req.identity!,req.get('Idempotency-Key'),req.body,clock())),
    sessions:wrap(req=>service.getSessions(pool,req.identity!,uuid(req.params.clientId),req.query)),
    zone:wrap(req=>service.changeZone(pool,req.identity!,uuid(req.params.clientId),req.get('Idempotency-Key'),req.body,clock())),
  }
}
