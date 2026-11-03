import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { pageInput, viewInput } from '../validators/support.js'
import {
  supportClients,
  supportClientView,
  supportLog,
} from '../repositories/support.js'
export const listSupportClients = (
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>
) => supportClients(pool, identity, pageInput(query))
export const viewSupportClient = (
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  body: unknown
) => {
  const input = viewInput(clientId, body)
  return supportClientView(pool, identity, input.clientId, input.reason)
}
export const readSupportLog = (
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>
) => {
  const { page, pageSize } = pageInput(query)
  return supportLog(pool, identity, { page, pageSize })
}
