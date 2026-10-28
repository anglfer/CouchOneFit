import type { Pool } from 'pg'
import type { SessionIdentity } from '../types/session.js'
import {
  audit,
  context,
  invalidInvitation,
  lockActor,
  lockInvitationRecord,
  transaction,
} from './lifecycle.js'

export async function replaceInvitation(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  digest: string,
  now?: Date
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    const record = await lockInvitationRecord(client, clientId, now)
    if (record.professionalUserId !== identity.id) throw invalidInvitation()
    await lockActor(client, identity, now, true)
    const {
      rows: [invitation],
    } = await client.query<{ expiresAt: Date }>(
      `INSERT INTO private.invitations (client_id,token_hash,created_at,expires_at)
       VALUES ($1,$2,COALESCE($3::timestamptz,statement_timestamp()),COALESCE($3::timestamptz,statement_timestamp())+interval '7 days')
       ON CONFLICT (client_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at
       RETURNING expires_at AS "expiresAt"`,
      [clientId, digest, now ?? null]
    )
    await audit(client, 'invitation_issued', identity.id, null, clientId, now)
    return invitation.expiresAt.toISOString()
  })
}

export async function deleteInvitation(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  now?: Date
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    await context(client, 'client_id', clientId)
    const {
      rows: [record],
    } = await client.query<{ user_id: string }>(
      `SELECT p.user_id FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=$1 FOR UPDATE OF c`,
      [clientId]
    )
    if (!record || record.user_id !== identity.id) throw invalidInvitation()
    await lockActor(client, identity, now, true)
    await context(client, 'client_id', clientId)
    await client.query('DELETE FROM private.invitations WHERE client_id=$1', [
      clientId,
    ])
    await audit(client, 'invitation_revoked', identity.id, null, clientId, now)
  })
}

export async function validateInvitationHash(
  pool: Pool,
  digest: string,
  now?: Date
) {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', '')
    const {
      rows: [candidate],
    } = await client.query<{ client_id: string }>(
      'SELECT client_id FROM private.invitations WHERE token_hash=$1',
      [digest]
    )
    if (!candidate) throw invalidInvitation()
    await lockInvitationRecord(client, candidate.client_id, now, digest)
    const { rowCount } = await client.query(
      'SELECT id FROM private.invitations WHERE client_id=$1 AND token_hash=$2 AND expires_at>COALESCE($3::timestamptz,clock_timestamp()) FOR UPDATE',
      [candidate.client_id, digest, now ?? null]
    )
    if (!rowCount) throw invalidInvitation()
    return { valid: true }
  })
}

export async function insertActivatedAccount(
  pool: Pool,
  data: {
    username: string
    email: string
    noticeVersion: string
    codeHash: string
  },
  digest: string,
  now?: Date
) {
  await transaction(pool, async (client) => {
    await context(client, 'subject_id', '')
    const {
      rows: [candidate],
    } = await client.query<{ client_id: string }>(
      'SELECT client_id FROM private.invitations WHERE token_hash=$1',
      [data.codeHash]
    )
    if (!candidate) throw invalidInvitation()
    await lockInvitationRecord(client, candidate.client_id, now, data.codeHash)
    const {
      rows: [invitation],
    } = await client.query<{ id: string }>(
      'SELECT id FROM private.invitations WHERE client_id=$1 AND token_hash=$2 AND expires_at>COALESCE($3::timestamptz,clock_timestamp()) FOR UPDATE',
      [candidate.client_id, data.codeHash, now ?? null]
    )
    if (!invitation) throw invalidInvitation()
    await context(client, 'access_operation', 'activation')
    const {
      rows: [account],
    } = await client.query<{ id: string }>(
      "INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,'client') RETURNING id",
      [data.username, data.email, digest]
    )
    const { rows: [link] } = await client.query<{ linked: boolean }>(
      'SELECT private.link_invited_client($1,$2,$3) AS linked',
      [data.codeHash, account.id, now ?? null]
    )
    if (!link.linked) throw invalidInvitation()
    await client.query(
      'INSERT INTO private.notice_acceptances (user_id,version,accepted_at) VALUES ($1,$2,COALESCE($3::timestamptz,clock_timestamp()))',
      [account.id, data.noticeVersion, now ?? null]
    )
    const deleted = await client.query(
      'DELETE FROM private.invitations WHERE id=$1',
      [invitation.id]
    )
    if (deleted.rowCount !== 1) throw invalidInvitation()
    await audit(
      client,
      'account_activated',
      account.id,
      account.id,
      candidate.client_id,
      now
    )
  })
}
