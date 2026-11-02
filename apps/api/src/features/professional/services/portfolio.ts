import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { uuid } from '../../auth/validators/lifecycle.js'
import { portfolioQuery, portfolioCursor } from '../validators/portfolio.js'
import { portfolioPage, portfolioRecord } from '../repositories/portfolio.js'

export async function listPortfolio(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) {
  const query = portfolioQuery(input, identity.id)
  const result = await portfolioPage(pool, identity, query, now)
  const hasMore = result.clients.length > query.pageSize
  const rows = result.clients.slice(0, query.pageSize)
  const last = rows.at(-1)
  return {
    clients: rows.map(
      ({ cursorCreatedAt: _cursor, created_at: _created, ...record }) => record
    ),
    hasClients: result.hasClients,
    pageInfo: {
      pageSize: query.pageSize,
      hasMore,
      nextCursor:
        hasMore && last
          ? portfolioCursor(identity.id, query, last.cursorCreatedAt, last.id)
          : null
    }
  }
}

export async function readPortfolioRecord(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  now?: Date
) {
  const record = await portfolioRecord(pool, identity, uuid(id), now)
  if (!record)
    throw new AuthError(
      404,
      'CLIENT_NOT_FOUND',
      'El expediente no está disponible.'
    )
  return { client: record }
}
