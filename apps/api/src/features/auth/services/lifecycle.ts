import { argon2id, hash, verify } from 'argon2'
import type { Pool } from 'pg'
import type { SessionIdentity } from '../types/session.js'
import {
  updateCredentials,
  replacePasswordReset,
  consumePasswordReset,
} from '../repositories/credentials.js'
import {
  replaceInvitation,
  deleteInvitation,
  validateInvitationHash,
  insertActivatedAccount,
} from '../repositories/invitations.js'
import {
  code,
  payload,
  validateActivation,
  validateCredentials,
  validateReset,
  validateVerification,
} from '../validators/lifecycle.js'
import { loginAccount } from './session.js'
import { randomToken, tokenHash } from './tokens.js'
import {
  authorizedRecoveryTargets,
} from '../repositories/access-records.js'
export function listRecoveryTargets(pool: Pool, identity: SessionIdentity) {
  return authorizedRecoveryTargets(pool, identity)
}
const passwordHash = (password: string) =>
  hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
export async function changeCredentials(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) {
  const data = validateCredentials(input)
  return updateCredentials(
    pool,
    identity,
    data.username,
    await passwordHash(data.password),
    (digest) => verify(digest, data.currentPassword),
    now
  )
}
export async function issueInvitation(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  now?: Date
) {
  const secret = randomToken()
  const expiresAt = await replaceInvitation(
    pool,
    identity,
    clientId,
    tokenHash(secret),
    now
  )
  return { code: secret, expiresAt }
}
export function revokeInvitation(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  now?: Date
) {
  return deleteInvitation(pool, identity, clientId, now)
}
export function prevalidateInvitation(pool: Pool, input: unknown, now?: Date) {
  const body = payload(input, ['code'])
  return validateInvitationHash(pool, tokenHash(code(body.code)), now)
}
export async function activateAccount(pool: Pool, input: unknown, now?: Date) {
  const data = validateActivation(input)
  await insertActivatedAccount(
    pool,
    {
      username: data.username,
      email: data.email,
      noticeVersion: data.noticeVersion,
      codeHash: tokenHash(data.code),
    },
    await passwordHash(data.password),
    now
  )
  // Session issuance is after COMMIT. Failed issuance leaves a linked account ready for login.
  try {
    const session = await loginAccount(
      pool,
      { identifier: data.username, password: data.password },
      'client',
      now
    )
    return { activated: true as const, session }
  } catch {
    return { activated: true as const, session: null }
  }
}
export async function issueReset(
  pool: Pool,
  identity: SessionIdentity,
  targetId: string,
  input: unknown,
  now?: Date
) {
  const data = validateVerification(input)
  const secret = randomToken()
  const expiresAt = await replacePasswordReset(
    pool,
    identity,
    targetId,
    tokenHash(secret),
    (digest) => verify(digest, data.currentPassword),
    now
  )
  return { code: secret, expiresAt }
}
export async function resetPassword(pool: Pool, input: unknown, now?: Date) {
  const data = validateReset(input)
  return consumePasswordReset(
    pool,
    tokenHash(data.code),
    await passwordHash(data.password),
    now
  )
}
