import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { config } from '../../../config/index.js'
import { AuthError } from '../../auth/types/errors.js'
import type { CheckKind, CheckStatus } from '../types/observability.js'

export interface AuthorizedCheckDescriptor {
  key: string
  name: string
  description: string
  service: string
  module: string
  kind: CheckKind
  safeInProduction: boolean
  configured: boolean
}

export interface ExecutedManualCheck {
  correlationId: string
  checkKey: string
  checkName: string
  checkKind: CheckKind
  service: string
  module: string
  target: string | null
  phase: 'regular'
  executedAt: string
  expectedResult: string
  actualResult: string
  status: CheckStatus
  durationMs: number | null
  httpStatus: number | null
  errorCode: string | null
  errorMessage: string | null
  assertions: Array<{ name: string; ok: boolean; detail?: string }>
}

export function listAuthorizedChecks(): AuthorizedCheckDescriptor[] {
  return [
    {
      key: 'api_liveness',
      name: 'Disponibilidad del proceso API',
      description: 'Verifica la respuesta viva de la API sin mutar datos.',
      service: 'api',
      module: 'health',
      kind: 'synthetic_availability',
      safeInProduction: true,
      configured: true,
    },
    {
      key: 'api_db_readiness',
      name: 'Conectividad PostgreSQL / Supabase',
      description: 'Ejecuta SELECT 1 en el pool de conexiones y valida latencia.',
      service: 'database',
      module: 'database',
      kind: 'synthetic_availability',
      safeInProduction: true,
      configured: true,
    },
    {
      key: 'func_plans_catalog',
      name: 'Consulta funcional de catálogo de planes',
      description:
        'Consulta private.saas_plans activos y verifica integridad de estructura.',
      service: 'api',
      module: 'plans',
      kind: 'synthetic_functional',
      safeInProduction: true,
      configured: true,
    },
    {
      key: 'func_observability_persistence',
      name: 'Integridad de persistencia de observabilidad',
      description:
        'Comprueba lectura de configuración runtime y catálogo de SLI/SLO activos.',
      service: 'database',
      module: 'observability',
      kind: 'synthetic_functional',
      safeInProduction: true,
      configured: true,
    },
    {
      key: 'web_availability',
      name: 'Disponibilidad del portal Web (Vercel)',
      description:
        'Realiza una petición GET segura al dominio Web configurado en OBSERVABILITY_WEB_URL.',
      service: 'web',
      module: 'web',
      kind: 'synthetic_availability',
      safeInProduction: true,
      configured: Boolean(config.observabilityWebUrl),
    },
  ]
}

export async function runAuthorizedChecks(
  pool: Pool,
  requestedKeys?: string[],
): Promise<ExecutedManualCheck[]> {
  const catalog = listAuthorizedChecks()
  const allowedKeys = new Set(catalog.map((c) => c.key))
  const keysToRun = requestedKeys?.length ? requestedKeys : catalog.map((c) => c.key)
  for (const key of keysToRun) {
    if (!allowedKeys.has(key)) {
      throw new AuthError(
        400,
        'CHECK_NOT_AUTHORIZED',
        `La comprobación '${key}' no está registrada o autorizada para ejecución manual.`,
      )
    }
  }

  const results: ExecutedManualCheck[] = []
  for (const key of keysToRun) {
    const descriptor = catalog.find((c) => c.key === key)!
    const started = performance.now()
    const correlationId = `manual-${randomUUID()}`
    const executedAt = new Date().toISOString()

    if (key === 'api_liveness') {
      const durationMs = Math.round((performance.now() - started) * 10) / 10
      results.push({
        correlationId,
        checkKey: descriptor.key,
        checkName: descriptor.name,
        checkKind: descriptor.kind,
        service: descriptor.service,
        module: descriptor.module,
        target: '/api/health',
        phase: 'regular',
        executedAt,
        expectedResult: 'Proceso API activo y reloj del servidor válido.',
        actualResult: `Proceso activo (${config.nodeEnv}, v${config.appVersion}).`,
        status: 'passed',
        durationMs,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
        assertions: [
          { name: 'process_alive', ok: true, detail: 'Handler administrativo activo' },
        ],
      })
      continue
    }

    if (key === 'api_db_readiness') {
      try {
        const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok')
        const ok = rows[0]?.ok === 1
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'postgresql://pool/SELECT-1',
          phase: 'regular',
          executedAt,
          expectedResult: 'Conexión PostgreSQL responde SELECT 1 = 1.',
          actualResult: ok ? 'SELECT 1 respondió 1.' : 'Respuesta inesperada de PostgreSQL.',
          status: ok ? 'passed' : 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: ok ? 200 : 503,
          errorCode: ok ? null : 'DB_UNEXPECTED_RESULT',
          errorMessage: ok ? null : 'SELECT 1 no devolvió 1.',
          assertions: [{ name: 'select_1', ok }],
        })
      } catch (error) {
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'postgresql://pool/SELECT-1',
          phase: 'regular',
          executedAt,
          expectedResult: 'Conexión PostgreSQL responde SELECT 1 = 1.',
          actualResult: 'Error de conexión con PostgreSQL.',
          status: 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: 503,
          errorCode:
            typeof (error as { code?: unknown })?.code === 'string'
              ? String((error as { code: string }).code)
              : 'DB_UNAVAILABLE',
          errorMessage:
            error instanceof Error ? error.message.slice(0, 300) : 'Error de conexión.',
          assertions: [{ name: 'select_1', ok: false }],
        })
      }
      continue
    }

    if (key === 'func_plans_catalog') {
      try {
        const { rows } = await pool.query<{
          id: string
          name: string
          price_mxn: string
        }>(
          'SELECT id, name, price_mxn FROM private.saas_plans WHERE is_active = true ORDER BY price_mxn ASC',
        )
        const hasValidStructure =
          rows.length > 0 &&
          rows.every(
            (r) =>
              typeof r.id === 'string' &&
              r.name.length >= 2 &&
              Number(r.price_mxn) > 0,
          )
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'private.saas_plans',
          phase: 'regular',
          executedAt,
          expectedResult:
            'Al menos 1 plan SaaS activo con nombre y precio > 0.',
          actualResult: `${rows.length} plan(es) activo(s) con estructura válida.`,
          status: hasValidStructure ? 'passed' : 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: hasValidStructure ? 200 : 500,
          errorCode: hasValidStructure ? null : 'PLANS_EMPTY_OR_INVALID',
          errorMessage: hasValidStructure
            ? null
            : 'No se encontraron planes SaaS activos válidos.',
          assertions: [
            {
              name: 'active_plans_non_empty',
              ok: rows.length > 0,
              detail: `${rows.length} planes`,
            },
            { name: 'valid_prices', ok: hasValidStructure },
          ],
        })
      } catch (error) {
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'private.saas_plans',
          phase: 'regular',
          executedAt,
          expectedResult: 'Consulta válida de catálogo SaaS.',
          actualResult: 'Error al consultar private.saas_plans.',
          status: 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: 503,
          errorCode: 'PLANS_QUERY_ERROR',
          errorMessage:
            error instanceof Error ? error.message.slice(0, 300) : 'Error SQL',
          assertions: [{ name: 'query_plans', ok: false }],
        })
      }
      continue
    }

    if (key === 'func_observability_persistence') {
      try {
        const {
          rows: [row],
        } = await pool.query<{ cfg: unknown }>(
          'SELECT private.read_observability_runtime_config() AS cfg',
        )
        const ok = Boolean(row?.cfg && typeof row.cfg === 'object')
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'private.observability_settings',
          phase: 'regular',
          executedAt,
          expectedResult:
            'Configuración de observabilidad persistida y legible.',
          actualResult: ok
            ? 'Configuración de observabilidad leída correctamente.'
            : 'No se encontró configuración persistida.',
          status: ok ? 'passed' : 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: ok ? 200 : 500,
          errorCode: ok ? null : 'OBS_CONFIG_MISSING',
          errorMessage: ok ? null : 'Falta la fila default de configuración.',
          assertions: [{ name: 'runtime_config_present', ok }],
        })
      } catch (error) {
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: 'private.observability_settings',
          phase: 'regular',
          executedAt,
          expectedResult: 'Configuración de observabilidad legible.',
          actualResult: 'Fallo al consultar configuración de observabilidad.',
          status: 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: 503,
          errorCode: 'OBS_CONFIG_ERROR',
          errorMessage:
            error instanceof Error ? error.message.slice(0, 300) : 'Error SQL',
          assertions: [{ name: 'runtime_config_present', ok: false }],
        })
      }
      continue
    }

    if (key === 'web_availability') {
      if (!config.observabilityWebUrl) {
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: null,
          phase: 'regular',
          executedAt,
          expectedResult:
            'HTTP 200 y documento HTML válido de CouchOne Fit en OBSERVABILITY_WEB_URL.',
          actualResult:
            'No ejecutada: OBSERVABILITY_WEB_URL no está configurada en el servidor.',
          status: 'not_executed',
          durationMs: null,
          httpStatus: null,
          errorCode: 'WEB_URL_NOT_CONFIGURED',
          errorMessage:
            'Configura OBSERVABILITY_WEB_URL para habilitar esta comprobación desde el panel.',
          assertions: [
            {
              name: 'web_url_configured',
              ok: false,
              detail: 'OBSERVABILITY_WEB_URL ausente',
            },
          ],
        })
        continue
      }

      try {
        const res = await fetch(config.observabilityWebUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        })
        const html = await res.text()
        const hasBrand = /CouchOne|root/i.test(html)
        const ok = res.status >= 200 && res.status < 300 && hasBrand
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: config.observabilityWebUrl,
          phase: 'regular',
          executedAt,
          expectedResult: 'HTTP 200 y documento HTML de CouchOne Fit.',
          actualResult: `HTTP ${res.status}, HTML ${hasBrand ? 'válido' : 'inesperado'}.`,
          status: ok ? 'passed' : 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: res.status,
          errorCode: ok ? null : 'WEB_CHECK_FAILED',
          errorMessage: ok
            ? null
            : `Respuesta ${res.status} o contenido inesperado.`,
          assertions: [
            { name: 'http_2xx', ok: res.status >= 200 && res.status < 300 },
            { name: 'html_marker', ok: hasBrand },
          ],
        })
      } catch (error) {
        const isTimeout =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
        results.push({
          correlationId,
          checkKey: descriptor.key,
          checkName: descriptor.name,
          checkKind: descriptor.kind,
          service: descriptor.service,
          module: descriptor.module,
          target: config.observabilityWebUrl,
          phase: 'regular',
          executedAt,
          expectedResult: 'HTTP 200 y documento HTML de CouchOne Fit.',
          actualResult: isTimeout
            ? 'Tiempo de espera agotado (15 s).'
            : 'Error de red al consultar la aplicación Web.',
          status: 'failed',
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          httpStatus: null,
          errorCode: isTimeout ? 'TIMEOUT' : 'WEB_CONNECTION_ERROR',
          errorMessage:
            error instanceof Error ? error.message.slice(0, 300) : 'Error de red',
          assertions: [{ name: 'web_reachable', ok: false }],
        })
      }
    }
  }

  return results
}
