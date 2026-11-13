import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { evolutionSample } from '../domain/evolution.js'
import type { EvolutionQuery, EvolutionSample } from '../types/evolution.js'
import { evolutionTimestamp } from '../validators/evolution.js'
import { mapEvaluation, readAuthorizedEvaluations } from './evaluation.js'

const storedMethods = {
  perimetros: 'circumference',
  pliegues: 'skinfolds',
  bioimpedancia: 'bioimpedance',
  legacy: 'legacy',
} as const
// Fixed SQL expressions owned by the server, never names supplied by the browser.
const historicalDate =
  "COALESCE(to_jsonb(e)->'assessment'->>'effectiveDate',e.evaluation_date::text)::date"
const storedMethod = "to_jsonb(e)->'assessment'->>'method'"

/** Reads one extra row; no OFFSET, writes, new storage or historical recalculation. */
export function readEvolutionRows(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  query: EvolutionQuery,
  now?: Date,
): Promise<EvolutionSample[]> {
  return readAuthorizedEvaluations(
    pool,
    identity,
    clientId,
    async (client) => {
      const { rows } = await client.query<{
        evaluation: Record<string, unknown>
        cursorCreatedAt: string
      }>(
        `SELECT to_jsonb(e) AS evaluation,
        to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt"
       FROM private.client_evaluations e
       WHERE e.client_id=$1
         AND ($2::date IS NULL OR ${historicalDate}>=$2::date)
         AND ($3::date IS NULL OR ${historicalDate}<=$3::date)
         AND ($4::text IS NULL OR ($4='legacy' AND ${storedMethod} IS NULL) OR ${storedMethod}=$4)
         AND ($5::date IS NULL OR (${historicalDate},e.created_at,e.id)>($5::date,$6::timestamptz,$7::uuid))
       ORDER BY ${historicalDate} ASC,e.created_at ASC,e.id ASC LIMIT $8`,
        [
          clientId,
          query.from,
          query.to,
          query.method === null ? null : storedMethods[query.method],
          query.after?.date ?? null,
          query.after?.createdAt ?? null,
          query.after?.id ?? null,
          query.pageSize + 1,
        ],
      )
      return rows.map((row) =>
        evolutionSample(
          mapEvaluation(
            row.evaluation,
            evolutionTimestamp(row.cursorCreatedAt),
          ),
        ),
      )
    },
    now,
  )
}
