import type { Pool } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import { jwtKey } from '../../auth/services/tokens.js'
import { uuid } from '../../auth/validators/lifecycle.js'
import { readEvolutionRows } from '../repositories/evolution.js'
import { EVOLUTION_METRICS, type EvolutionPage } from '../types/evolution.js'
import { evolutionCursor, evolutionQuery } from '../validators/evolution.js'

export async function getEvaluationHistory(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  input: unknown,
  now?: Date,
): Promise<EvolutionPage> {
  if (identity.role !== 'professional')
    throw new AuthError(
      403,
      'EVALUATION_FORBIDDEN',
      'No tienes permiso para consultar esta evolución.',
    )
  const id = uuid(clientId)
  const scope = { subjectId: identity.id, clientId: id }
  const key = jwtKey()
  const query = evolutionQuery(input, scope, key)
  const rows = await readEvolutionRows(pool, identity, id, query, now)
  const hasMore = rows.length > query.pageSize
  const samples = rows.slice(0, query.pageSize)
  const last = samples.at(-1)
  return {
    clientId: id,
    period: { from: query.from, to: query.to },
    method: query.method,
    order: 'asc',
    metricDefinitions: EVOLUTION_METRICS,
    samples,
    pageInfo: {
      pageSize: query.pageSize,
      hasMore,
      nextCursor:
        hasMore && last ? evolutionCursor(scope, query, last, key) : null,
    },
  }
}
