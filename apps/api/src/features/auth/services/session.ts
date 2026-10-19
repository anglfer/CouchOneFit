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

export async function loginAccount(
  pool: Pool,
  input: unknown,
  surface: 'web' | 'client' = 'web',
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
): Promise<SessionIdentity> {
  if (!token) throw invalidSession()
  const { id, sid } = await verifyAccess(token)
  const identity = await currentSession(pool, id, sid, surface)
  if (!identity) {
    await revokeSession(pool, sid, id)
    throw invalidSession()
  }
  return identity
}

export async function refreshAccount(
  pool: Pool,
  token: string | undefined,
  surface: 'web' | 'client' = 'web',
) {
  if (!token || !/^[\w-]{43}$/.test(token)) throw invalidSession()
  const refresh = randomToken()
  const session = await rotateSession(
    pool,
    tokenHash(token),
    tokenHash(refresh),
    signAccess,
    surface,
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
