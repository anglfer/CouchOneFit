import type { Pool } from 'pg'
import type { ProfessionalIdentity, SessionIdentity } from '../types/session.js'

export interface LoginAccount {
  id: string
  passwordHash: string
  role: string
  status: string
}
export async function findLoginAccount(
  pool: Pool,
  identifier: string,
): Promise<LoginAccount | undefined> {
  const column = identifier.includes('@') ? 'correo' : 'usuario'
  const {
    rows: [row],
  } = await pool.query<LoginAccount>(
    `SELECT id,hash_contrasena AS "passwordHash",rol AS role,estado AS status FROM privado.usuarios WHERE lower(btrim(${column}))=$1`,
    [identifier],
  )
  return row
}
export async function currentSession(
  pool: Pool,
  id: string,
  sid: string,
): Promise<SessionIdentity | undefined> {
  const {
    rows: [row],
  } = await pool.query<SessionIdentity>(
    `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role,s.id AS "sessionId",s.expira_en AS "expiresAt"
     FROM privado.sesiones s JOIN privado.usuarios a ON a.id=s.usuario_id
     LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
     WHERE s.id=$1 AND a.id=$2 AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL)) AND a.estado='activo'
       AND s.revocado_en IS NULL AND s.expira_en>clock_timestamp()`,
    [sid, id],
  )
  return row
}
export async function professionalProfile(
  pool: Pool,
  identity: SessionIdentity,
) {
  const {
    rows: [profile],
  } = await pool.query(
    `SELECT p.id,p.usuario_id AS "accountId",p.nombre_completo AS "fullName",p.telefono AS phone,a.usuario AS username,a.correo AS email
     FROM privado.profesionales p JOIN privado.usuarios a ON a.id=p.usuario_id
     JOIN privado.sesiones s ON s.usuario_id=a.id
     WHERE p.usuario_id=$1 AND s.id=$2 AND a.rol='profesional' AND a.estado='activo'
       AND s.revocado_en IS NULL AND s.expira_en>clock_timestamp()`,
    [identity.id, identity.sessionId],
  )
  return profile
}
export function publicAccount(identity: ProfessionalIdentity) {
  return {
    id: identity.id,
    username: identity.username,
    email: identity.email,
    fullName: identity.fullName,
    role: identity.role === 'administrador' ? 'admin' : 'professional',
    status: 'active',
    subscription: null,
  }
}
