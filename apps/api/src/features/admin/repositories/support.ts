import type { Pool } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { transaction, context } from '../../auth/repositories/lifecycle.js'
import type { SessionIdentity } from '../../auth/types/session.js'

// DEC-017: read-only support. Every read goes through narrow definer functions that
// require an active administrator; the runtime has no SELECT on client records.
export async function supportClients(
  pool: Pool,
  identity: SessionIdentity,
  q: { search: string; page: number; pageSize: number }
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    const { rows } = await client.query(
      'SELECT * FROM private.support_clients($1,$2,$3)',
      [q.search, q.pageSize, (q.page - 1) * q.pageSize]
    )
    return {
      total: rows.length ? Number(rows[0].total) : 0,
      page: q.page,
      pageSize: q.pageSize,
      clients: rows.map((r) => ({
        clientId: r.client_id,
        userId: r.user_id,
        fullName: r.full_name,
        username: r.username,
        accountStatus: r.account_status,
        recordStatus: r.record_status,
        professionalName: r.professional_name,
      })),
    }
  })
}

export async function supportClientView(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  reason: string
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    const {
      rows: [row],
    } = await client.query('SELECT private.support_client_view($1,$2) AS view', [
      clientId,
      reason,
    ])
    if (!row.view)
      throw new AuthError(404, 'CLIENT_NOT_FOUND', 'El expediente no existe.')
    return row.view as Record<string, unknown>
  })
}

export async function supportLog(
  pool: Pool,
  identity: SessionIdentity,
  q: { page: number; pageSize: number }
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    const { rows } = await client.query(
      'SELECT * FROM private.support_log_page($1,$2)',
      [q.pageSize, (q.page - 1) * q.pageSize]
    )
    return {
      total: rows.length ? Number(rows[0].total) : 0,
      page: q.page,
      pageSize: q.pageSize,
      entries: rows.map((r) => ({
        id: r.id,
        action: r.action,
        reason: r.reason,
        createdAt: r.created_at,
        adminUsername: r.admin_username,
        clientId: r.client_id,
        clientName: r.client_name,
      })),
    }
  })
}
