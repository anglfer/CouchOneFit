import { hash, verify, argon2id } from 'argon2'
import type { Pool } from 'pg'
import { publicAccount } from './account.js'
import { validateLogin } from '../validators/login.js'
import { randomToken, tokenHash, signAccess, verifyAccess } from './tokens.js'
import {
  findLoginAccount,
  currentSession,
  insertSession,
  rotateSession,
  revokeSession,
  revokeRefreshSession,
} from '../repositories/session.js'
import type { SessionIdentity } from '../types/session.js'
import { invalidLogin, invalidSession } from '../types/errors.js'

let dummyHash: Promise<string> | undefined

export async function loginAccount(pool: Pool, input: unknown) {
  const data = validateLogin(input)
  const account = await findLoginAccount(pool, data.identifier)
  // Igualar el trabajo de hash también para identificadores inexistentes.
  const digest =
    account?.passwordHash ??
    (await (dummyHash ??= hash(randomToken(), {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })))
  const matches = await verify(digest, data.password)
  if (
    !account ||
    !matches ||
    !['profesional', 'administrador'].includes(account.role) ||
    account.status !== 'activo'
  )
    throw invalidLogin()
  const refresh = randomToken()
  const session = await insertSession(
    pool,
    account.id,
    account.passwordHash,
    tokenHash(refresh),
    signAccess,
  )
  return {
    access: session.access,
    refresh,
    expiresAt: session.expiresAt,
    account: publicAccount(session.identity),
  }
}

export async function authenticate(
  pool: Pool,
  token: string | undefined,
): Promise<SessionIdentity> {
  if (!token) throw invalidSession()
  const { id, sid } = await verifyAccess(token)
  const identity = await currentSession(pool, id, sid)
  if (!identity) {
    await revokeSession(pool, sid, id)
    throw invalidSession()
  }
  return identity
}

export async function refreshAccount(pool: Pool, token: string | undefined) {
  if (!token || !/^[\w-]{43}$/.test(token)) throw invalidSession()
  const refresh = randomToken()
  const session = await rotateSession(
    pool,
    tokenHash(token),
    tokenHash(refresh),
    signAccess,
  )
  if (!session) return null
  return {
    access: session.access,
    refresh,
    expiresAt: session.expiresAt,
    account: publicAccount(session.identity),
  }
}

export async function logoutAccount(
  pool: Pool,
  refresh: string | undefined,
  access: string | undefined,
) {
  if (refresh && /^[\w-]{43}$/.test(refresh)) {
    await revokeRefreshSession(pool, tokenHash(refresh))
    return
  }
  if (access) {
    const { id, sid } = await verifyAccess(access)
    await revokeSession(pool, sid, id)
  }
}
