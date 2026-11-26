import type { Request, RequestHandler, Response } from 'express'
import type { Pool } from 'pg'
import * as service from '../services/sla-v3-reports.js'

function wrap(run: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return async (req, res, next) => {
    try {
      await run(req, res)
    } catch (error) {
      next(error)
    }
  }
}

export function slaV3AdminControllers(pool: Pool, now?: () => Date) {
  const exportCsv = (kind: 'requests' | 'probes' | 'incidents' | 'operations') =>
    wrap(async (req, res) => {
      const exported = await service.exportSlaCsv(pool, req.identity!, kind, req.query, now?.())
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`)
      res.send(exported.content)
    })
  return {
    report: wrap(async (req, res) => {
      res.json(await service.buildSlaReport(pool, req.identity!, req.query, now?.()))
    }),
    requestsCsv: exportCsv('requests'),
    probesCsv: exportCsv('probes'),
    incidentsCsv: exportCsv('incidents'),
    operationsCsv: exportCsv('operations'),
    listRecords: wrap(async (req, res) => {
      res.json(await service.listSlaRecords(pool, req.identity!, req.query, now?.()))
    }),
    createRecord: wrap(async (req, res) => {
      res.status(201).json(await service.createSlaRecord(pool, req.identity!, req.body))
    }),
    deleteRecord: wrap(async (req, res) => {
      await service.deleteSlaRecord(pool, req.identity!, req.params.id)
      res.status(204).end()
    }),
    measureStorage: wrap(async (req, res) => {
      res.status(201).json(await service.measureSlaStorage(pool, req.identity!, req.body))
    }),
  }
}

export function slaV3PublicControllers(pool: Pool) {
  return {
    operations: wrap(async (req, res) => {
      const result = await service.ingestSlaOperation(pool, req.body)
      res.status(result.duplicate ? 200 : 201).json(result)
    }),
  }
}
