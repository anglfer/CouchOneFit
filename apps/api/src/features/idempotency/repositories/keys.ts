import type { Pool } from 'pg'
import { context, transaction } from '../../auth/repositories/lifecycle.js'

export type Claim =
  | { kind: 'new' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'mismatch' }
  | { kind: 'busy' }

// DEC-018: la clave se conserva más que la caducidad local de la cola (30 días).
const RETENTION = '35 days'
// Un reclamo sin terminar tras este plazo se considera abandonado (el servidor cayó a medias).
const ABANDONED = '2 minutes'

export function claimKey(
  pool: Pool,
  ownerId: string,
  key: string,
  hash: string
): Promise<Claim> {
  return transaction(pool, async (client): Promise<Claim> => {
    await context(client, 'subject_id', ownerId)
    await client.query(
      `DELETE FROM private.idempotency_keys
        WHERE owner_id=$1 AND created_at < clock_timestamp() - interval '${RETENTION}'`,
      [ownerId]
    )
    const inserted = await client.query(
      `INSERT INTO private.idempotency_keys (owner_id,key,request_hash) VALUES ($1,$2,$3)
       ON CONFLICT (owner_id,key) DO NOTHING RETURNING key`,
      [ownerId, key, hash]
    )
    if (inserted.rowCount) return { kind: 'new' }
    const {
      rows: [row],
    } = await client.query(
      `SELECT request_hash AS "hash",status_code AS "status",response AS "body",
              created_at < clock_timestamp() - interval '${ABANDONED}' AS abandoned
         FROM private.idempotency_keys WHERE owner_id=$1 AND key=$2 FOR UPDATE`,
      [ownerId, key]
    )
    if (!row) return { kind: 'busy' }
    if (row.hash !== hash) return { kind: 'mismatch' }
    if (row.status !== null) return { kind: 'replay', status: row.status, body: row.body }
    if (!row.abandoned) return { kind: 'busy' }
    await client.query(
      'UPDATE private.idempotency_keys SET created_at=clock_timestamp() WHERE owner_id=$1 AND key=$2',
      [ownerId, key]
    )
    return { kind: 'new' }
  })
}

export function completeKey(
  pool: Pool,
  ownerId: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', ownerId)
    await client.query(
      `UPDATE private.idempotency_keys
          SET status_code=$3,response=$4::jsonb,completed_at=clock_timestamp()
        WHERE owner_id=$1 AND key=$2`,
      [ownerId, key, status, JSON.stringify(body ?? null)]
    )
  })
}

/** Libera un reclamo sin terminar (la operación falló): el reintento se vuelve a ejecutar. */
export function releaseKey(
  pool: Pool,
  ownerId: string,
  key: string
): Promise<void> {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', ownerId)
    await client.query(
      'DELETE FROM private.idempotency_keys WHERE owner_id=$1 AND key=$2 AND status_code IS NULL',
      [ownerId, key]
    )
  })
}
