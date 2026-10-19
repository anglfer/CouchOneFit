import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'

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
