import type { Request, RequestHandler, Response } from 'express'
import type { Pool } from 'pg'
import * as service from '../services/observability.js'

function wrap(run: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return async (req, res, next) => {
    try {
      await run(req, res)
    } catch (error) {
      next(error)
    }
  }
}

export function observabilityAdminControllers(pool: Pool, now?: () => Date) {
  return {
    dashboard: wrap(async (req, res) => {
      res.json(
        await service.getDashboardSummary(pool, req.identity!, req.query, now?.()),
      )
    }),
    logs: wrap(async (req, res) => {
      res.json(await service.queryLogs(pool, req.identity!, req.query))
    }),
    logDetail: wrap(async (req, res) => {
      res.json(
        await service.getLogDetail(pool, req.identity!, req.params.id),
      )
    }),
    exportLogs: wrap(async (req, res) => {
      const exported = await service.exportLogs(pool, req.identity!, req.query)
      res.setHeader(
        'Content-Type',
        exported.format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/json; charset=utf-8',
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exported.filename}"`,
      )
      res.send(exported.content)
    }),
    listSlis: wrap(async (req, res) => {
      res.json(
        await service.listSlisWithValues(pool, req.identity!, req.query, now?.()),
      )
    }),
    createSli: wrap(async (req, res) => {
      res.status(201).json({
        sli: await service.createSli(pool, req.identity!, req.body),
      })
    }),
    updateSli: wrap(async (req, res) => {
      res.json({
        sli: await service.updateSli(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      })
    }),
    toggleSliStatus: wrap(async (req, res) => {
      res.json({
        sli: await service.toggleSliStatus(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      })
    }),
    sliVersions: wrap(async (req, res) => {
      res.json({
        versions: await service.getSliVersions(
          pool,
          req.identity!,
          req.params.id,
        ),
      })
    }),
    listSlos: wrap(async (req, res) => {
      res.json(
        await service.listSlosWithEvaluation(
          pool,
          req.identity!,
          req.query,
          now?.(),
        ),
      )
    }),
    createSlo: wrap(async (req, res) => {
      res.status(201).json({
        slo: await service.createSlo(pool, req.identity!, req.body),
      })
    }),
    updateSlo: wrap(async (req, res) => {
      res.json({
        slo: await service.updateSlo(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      })
    }),
    toggleSloStatus: wrap(async (req, res) => {
      res.json({
        slo: await service.toggleSloStatus(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      })
    }),
    evaluateSlos: wrap(async (req, res) => {
      res.json(
        await service.evaluateAndPersistSlos(
          pool,
          req.identity!,
          req.body,
          now?.(),
        ),
      )
    }),
    sloHistory: wrap(async (req, res) => {
      res.json(
        await service.getSloHistory(
          pool,
          req.identity!,
          req.params.id,
          req.query,
        ),
      )
    }),
    listSlas: wrap(async (req, res) => {
      res.json(
        await service.listSlasWithCompliance(
          pool,
          req.identity!,
          req.query,
          now?.(),
        ),
      )
    }),
    createSla: wrap(async (req, res) => {
      res.status(201).json(await service.createSla(pool, req.identity!, req.body))
    }),
    updateSla: wrap(async (req, res) => {
      res.json(
        await service.updateSla(pool, req.identity!, req.params.id, req.body),
      )
    }),
    toggleSlaStatus: wrap(async (req, res) => {
      res.json(
        await service.toggleSlaStatus(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      )
    }),
    checksOverview: wrap(async (req, res) => {
      res.json(await service.getChecksOverview(pool, req.identity!, req.query))
    }),
    runChecks: wrap(async (req, res) => {
      res.json(await service.executeManualChecks(pool, req.identity!, req.body))
    }),
    updateSettings: wrap(async (req, res) => {
      res.json({
        settings: await service.updateObservabilitySettings(
          pool,
          req.identity!,
          req.body,
        ),
      })
    }),
    pruneMaintenance: wrap(async (req, res) => {
      res.json(await service.runMaintenancePrune(pool, req.identity!))
    }),
    listIncidents: wrap(async (req, res) => {
      res.json(await service.listIncidents(pool, req.identity!, req.query))
    }),
    updateIncident: wrap(async (req, res) => {
      res.json({
        incident: await service.updateIncident(
          pool,
          req.identity!,
          req.params.id,
          req.body,
        ),
      })
    }),
    report: wrap(async (req, res) => {
      res.json(
        await service.buildPeriodReport(
          pool,
          req.identity!,
          req.query,
          now?.(),
        ),
      )
    }),
    audit: wrap(async (req, res) => {
      res.json(await service.listAudit(pool, req.identity!))
    }),
  }
}

export function observabilityPublicControllers(pool: Pool) {
  return {
    ingest: wrap(async (req, res) => {
      res.status(201).json(await service.ingestExternalRun(pool, req.body))
    }),
    monitorConfig: wrap(async (_req, res) => {
      res.json({ settings: await service.readMonitorConfig(pool) })
    }),
    clientEvents: wrap(async (req, res) => {
      const correlationId =
        typeof res.locals.requestId === 'string'
          ? res.locals.requestId
          : 'client-telemetry'
      res
        .status(202)
        .json(
          await service.recordClientTelemetry(
            pool,
            correlationId,
            req.identity!.role,
            req.body,
          ),
        )
    }),
  }
}
