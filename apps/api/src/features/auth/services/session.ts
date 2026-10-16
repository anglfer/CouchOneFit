import { hash, verify, argon2id } from 'argon2'
import type { Pool } from 'pg'
import { randomToken, tokenHash, signAccess, verifyAccess } from './tokens.js'
import {
  findLoginAccount,
  currentSession,
  publicAccount,
} from '../repositories/session.js'
import type { ProfessionalIdentity, SessionIdentity } from '../types/session.js'
import { AuthError } from '../types/errors.js'

const invalidLogin = () =>
  new AuthError(
    401,
    'INVALID_CREDENTIALS',
    'No pudimos iniciar sesión. Revisa tus credenciales o el estado de tu cuenta.',
  )
export const invalidSession = () =>
  new AuthError(
    401,
    'SESSION_REQUIRED',
    'Tu sesión venció o no está disponible. Inicia sesión de nuevo.',
  )
let dummyHash: Promise<string> | undefined

export async function loginAccount(pool: Pool, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const body = input as Record<string, unknown>
  if (
    Object.keys(body).some(
      (key) => !['identificador', 'contrasena'].includes(key),
    ) ||
    typeof body.identificador !== 'string' ||
    typeof body.contrasena !== 'string' ||
    !body.identificador.trim() ||
    body.identificador.length > 254 ||
    [...body.contrasena].length < 1 ||
    [...body.contrasena].length > 128
  )
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const account = await findLoginAccount(
    pool,
    body.identificador.trim().toLowerCase(),
  )
  // Igualar el trabajo de hash también para identificadores inexistentes.
  const digest =
    account?.passwordHash ??
    (await (dummyHash ??= hash(randomToken(), {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })))
  const matches = await verify(digest, body.contrasena)
  if (
    !account ||
    !matches ||
    !['profesional', 'administrador'].includes(account.role) ||
    account.status !== 'activo'
  )
    throw invalidLogin()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [identity],
    } = await client.query<ProfessionalIdentity>(
      `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role FROM privado.usuarios a
       LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
       WHERE a.id=$1 AND a.hash_contrasena=$2 AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL)) AND a.estado='activo'`,
      [account.id, account.passwordHash],
    )
    if (!identity) throw invalidLogin()
    const {
      rows: [session],
    } = await client.query<{ id: string; expiresAt: Date }>(
      'INSERT INTO privado.sesiones (usuario_id) VALUES ($1) RETURNING id,expira_en AS "expiresAt"',
      [account.id],
    )
    const refresh = randomToken()
    await client.query(
      'INSERT INTO privado.tokens_renovacion (hash_token,sesion_id) VALUES ($1,$2)',
      [tokenHash(refresh), session.id],
    )
    const access = await signAccess(account.id, session.id)
    await client.query('COMMIT')
    return {
      access,
      refresh,
      expiresAt: session.expiresAt,
      account: publicAccount(identity),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
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
    await pool.query(
      'UPDATE privado.sesiones SET revocado_en=clock_timestamp() WHERE id=$1 AND usuario_id=$2 AND revocado_en IS NULL',
      [sid, id],
    )
    throw invalidSession()
  }
  return identity
}

export async function refreshAccount(
  pool: Pool,
  token: string | undefined,
) {
  if (!token || !/^[\w-]{43}$/.test(token)) throw invalidSession()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [row],
    } = await client.query<
      ProfessionalIdentity & {
        sessionId: string
        expiresAt: Date
        usedAt: Date | null
        revokedAt: Date | null
        valid: boolean
      }
    >(
      `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role,s.id AS "sessionId",s.expira_en AS "expiresAt",s.revocado_en AS "revokedAt",t.usado_en AS "usedAt",
       (s.expira_en>clock_timestamp() AND a.estado='activo' AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL))) AS valid
       FROM privado.tokens_renovacion t JOIN privado.sesiones s ON s.id=t.sesion_id
       JOIN privado.usuarios a ON a.id=s.usuario_id LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
       WHERE t.hash_token=$1 FOR UPDATE OF s,t`,
      [tokenHash(token)],
    )
    if (!row || row.revokedAt) throw invalidSession()
    if (row.usedAt || !row.valid) {
      await client.query(
        'UPDATE privado.sesiones SET revocado_en=clock_timestamp() WHERE id=$1',
        [row.sessionId],
      )
      await client.query('COMMIT')
      return null
    }
    const refresh = randomToken()
    await client.query(
      'UPDATE privado.tokens_renovacion SET usado_en=clock_timestamp() WHERE hash_token=$1',
      [tokenHash(token)],
    )
    await client.query(
      'INSERT INTO privado.tokens_renovacion (hash_token,sesion_id) VALUES ($1,$2)',
      [tokenHash(refresh), row.sessionId],
    )
    const access = await signAccess(row.id, row.sessionId)
    await client.query('COMMIT')
    return {
      access,
      refresh,
      expiresAt: row.expiresAt,
      account: publicAccount(row),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function logoutAccount(
  pool: Pool,
  refresh: string | undefined,
  access: string | undefined,
) {
  if (refresh && /^[\w-]{43}$/.test(refresh)) {
    await pool.query(
      `UPDATE privado.sesiones SET revocado_en=clock_timestamp()
      WHERE id=(SELECT sesion_id FROM privado.tokens_renovacion WHERE hash_token=$1) AND revocado_en IS NULL`,
      [tokenHash(refresh)],
    )
    return
  }
  if (access) {
    const { id, sid } = await verifyAccess(access)
    await pool.query(
      'UPDATE privado.sesiones SET revocado_en=clock_timestamp() WHERE id=$1 AND usuario_id=$2 AND revocado_en IS NULL',
      [sid, id],
    )
  }
}
