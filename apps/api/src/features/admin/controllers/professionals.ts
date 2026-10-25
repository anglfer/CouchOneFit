import type { RequestHandler } from 'express';
import type { Pool } from 'pg';

export function adminProfessionalsController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT 
           p.id,
           u.email,
           p.full_name AS "firstName",
           '' AS "lastName",
           CASE 
             WHEN u.status = 'inactive' THEN 'suspended'
             ELSE COALESCE(s.status, 'none')
           END AS status,
           COALESCE(p_saas.name, 'Sin Plan') AS "planName",
           p_saas.max_clients AS "maxClients",
           (
             SELECT count(*)::int 
             FROM private.clients c 
             WHERE c.professional_id = p.id AND c.status = 'active'
           ) AS "usedClients"
         FROM private.professionals p
         JOIN private.users u ON u.id = p.user_id
         LEFT JOIN private.subscriptions s ON s.professional_id = p.id
         LEFT JOIN private.saas_plans p_saas ON p_saas.id = s.plan_id
         ORDER BY u.created_at DESC`
      );

      res.json({ professionals: rows });
    } catch (error) {
      console.error("Error en directorio:", error);
      next(error);
    }
  };
}

export function updateSubscriptionController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const { id } = req.params;
    const { planId, status } = req.body;

    try {
      const { rows: [prof] } = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM private.professionals WHERE id = $1',
        [id]
      );

      if (!prof) {
        res.status(404).json({ error: 'Profesional no encontrado.' });
        return;
      }

      if (planId) {
        const updateResult = await pool.query(
          `UPDATE private.subscriptions 
           SET plan_id = $2, status = 'active' 
           WHERE professional_id = $1`,
          [id, planId]
        );

        if ((updateResult.rowCount ?? 0) === 0) {
          await pool.query(
            `INSERT INTO private.subscriptions (professional_id, plan_id, status, expires_at)
             VALUES ($1, $2, 'active', NOW() + INTERVAL '1 year')`,
            [id, planId]
          );
        }

        await pool.query(
          `UPDATE private.users SET status = 'active' WHERE id = $1`,
          [prof.user_id]
        );
      } else if (status) {
        const newSubStatus = status === 'activate' || status === 'active' ? 'active' : 'suspended';
        const newUserStatus = status === 'activate' || status === 'active' ? 'active' : 'inactive';

        await pool.query(
          `UPDATE private.subscriptions SET status = $2 WHERE professional_id = $1`,
          [id, newSubStatus]
        );

        await pool.query(
          `UPDATE private.users SET status = $2 WHERE id = $1`,
          [prof.user_id, newUserStatus]
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error al actualizar suscripción:", error);
      next(error);
    }
  };
}