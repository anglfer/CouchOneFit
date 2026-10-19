import { argon2id, hash, verify } from 'argon2'
import type { Pool } from 'pg'
import {
  currentSession,
  findLoginAccount,
  insertSession,
  revokeRefreshSession,
  revokeSession,
  rotateSession,
  updateAccountStatus,
} from '../repositories/session.js'
import { invalidLogin, invalidSession } from '../types/errors.js'
import type { SessionIdentity } from '../types/session.js'
import { validateLogin } from '../validators/login.js'
import { publicAccount } from './account.js'
import { randomToken, signAccess, tokenHash, verifyAccess } from './tokens.js'

let dummyHash: Promise<string> | undefined

export async function loginAccount(
  pool: Pool,
  input: unknown,
  surface: 'web' | 'client' = 'web',
  now?: Date,
) {
  const data = validateLogin(input)
  const account = await findLoginAccount(pool, data.identifier)
  // Keep password-hash work consistent for unknown identifiers.
  const digest =
    account?.passwordHash ??
    (await (dummyHash ??= hash(randomToken(), {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })))
  const matches = await verify(digest, data.password)
  const roleAllowed =
    surface === 'client'
      ? account?.role === 'client'
      : account?.role === 'professional' || account?.role === 'admin'
  if (!account || !matches || !roleAllowed || account.status !== 'active')
    throw invalidLogin()
  const refresh = randomToken()
  const session = await insertSession(
    pool,
    account.id,
    account.passwordHash,
    tokenHash(refresh),
    signAccess,
    surface,
    now,
  )
  if (!session) throw invalidLogin()
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
  surface: 'web' | 'any' = 'web',
  now?: Date,
): Promise<SessionIdentity> {
  if (!token) throw invalidSession()
  const { id, sid } = await verifyAccess(token, { now })
  const identity = await currentSession(pool, id, sid, surface, now)
  if (!identity) {
    await revokeSession(pool, sid, id, now)
    throw invalidSession()
  }
  return identity
}

export async function refreshAccount(
  pool: Pool,
  token: string | undefined,
  surface: 'web' | 'client' = 'web',
  now?: Date,
) {
  if (!token || !/^[\w-]{43}$/.test(token)) throw invalidSession()
  const refresh = randomToken()
  const session = await rotateSession(
    pool,
    tokenHash(token),
    tokenHash(refresh),
    signAccess,
    surface,
    now,
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
  now?: Date,
) {
  let revokedByRefresh = false
  if (refresh && /^[\w-]{43}$/.test(refresh)) {
    revokedByRefresh = await revokeRefreshSession(pool, tokenHash(refresh), now)
  }
  if (access) {
    try {
      const { id, sid } = await verifyAccess(access, { now })
      await revokeSession(pool, sid, id, now)
    } catch (error) {
      if (!revokedByRefresh) throw error
    }
  }
}

export async function setAccountStatus(
  pool: Pool,
  userId: string,
  status: 'active' | 'inactive',
  now?: Date,
) {
  return updateAccountStatus(pool, userId, status, now)
}
