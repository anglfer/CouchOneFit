import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import crypto from 'crypto';

export function getClientAccessListController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).user?.id;

    try {
      const { rows: [prof] } = await pool.query<{ id: string }>(
        'SELECT id FROM private.professionals WHERE user_id = $1',
        [userId]
      );

      if (!prof) {
        res.status(404).json({ error: 'Perfil profesional no encontrado.' });
        return;
      }

      const { rows } = await pool.query(
        `SELECT 
           c.id AS "clientId",
           c.id AS "id",
           c.full_name AS "fullName",
           c.goal AS "goal",
           c.user_id AS "userId",
           c.status AS "clientStatus",
           i.id AS "invitationId",
           i.created_at AS "invitationCreatedAt",
           i.expires_at AS "invitationExpiresAt",
           CASE 
             WHEN i.id IS NULL THEN 'pending'
             WHEN i.expires_at < NOW() THEN 'expired'
             ELSE 'active'
           END AS "invitationStatus"
         FROM private.clients c
         LEFT JOIN private.invitations i ON i.client_id = c.id
         WHERE c.professional_id = $1
         ORDER BY c.created_at DESC`,
        [prof.id]
      );

      res.json({ clients: rows });
    } catch (error) {
      console.error('Error al obtener lista de expedientes:', error);
      next(error);
    }
  };
}

export function getClientInvitationController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const clientId = req.params.id || req.params.clientId;

    try {
      const { rows } = await pool.query(
        `SELECT 
           id,
           created_at AS "createdAt",
           expires_at AS "expiresAt",
           CASE 
             WHEN expires_at < NOW() THEN 'expired'
             ELSE 'active'
           END AS status
         FROM private.invitations
         WHERE client_id = $1
         LIMIT 1`,
        [clientId]
      );

      res.json({ invitation: rows[0] || null });
    } catch (error) {
      console.error('Error al consultar invitación individual:', error);
      next(error);
    }
  };
}

export function generateInvitationController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).user?.id;
    // Permite recibir el clientId desde el body o los params de la URL
    const clientId = req.body.clientId || req.params.id || req.params.clientId;

    if (!clientId) {
      res.status(400).json({ error: 'ID de cliente no proporcionado.' });
      return;
    }

    try {
      const { rows: [sub] } = await pool.query<{
        professional_id: string;
        sub_status: string;
        max_clients: number | null;
      }>(
        `SELECT 
           p.id AS professional_id,
           COALESCE(s.status, 'none') AS sub_status,
           sp.max_clients
         FROM private.professionals p
         LEFT JOIN private.subscriptions s ON s.professional_id = p.id
         LEFT JOIN private.saas_plans sp ON sp.id = s.plan_id
         WHERE p.user_id = $1`,
        [userId]
      );

      if (!sub) {
        res.status(404).json({ error: 'Perfil profesional no encontrado.' });
        return;
      }

      // 2. Validar suscripción activa (DEC-005)
      if (sub.sub_status !== 'active') {
        res.status(403).json({ 
          code: 'SUBSCRIPTION_INACTIVE',
          error: 'Se requiere una suscripción activa para entregar accesos.' 
        });
        return;
      }

      if (sub.max_clients !== null) {
        const { rows: [{ count }] } = await pool.query<{ count: string }>(
          `SELECT count(*)::int AS count 
           FROM private.clients 
           WHERE professional_id = $1 AND status = 'active'`,
          [sub.professional_id]
        );

        const usedClients = parseInt(count, 10);
        if (usedClients > sub.max_clients) {
          res.status(409).json({
            code: 'CUPO_AGOTADO',
            error: 'Has alcanzado el límite de clientes activos permitido por tu plan.',
            limit: sub.max_clients,
            used: usedClients
          });
          return;
        }
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

      await pool.query(
        `INSERT INTO private.invitations (client_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (client_id)
         DO UPDATE SET 
           token_hash = EXCLUDED.token_hash, 
           created_at = NOW(), 
           expires_at = EXCLUDED.expires_at`,
        [clientId, tokenHash, expiresAt]
      );

      res.json({ 
        success: true, 
        token: rawToken, 
        expiresAt 
      });
    } catch (error) {
      console.error('Error al generar invitación:', error);
      next(error);
    }
  };
}