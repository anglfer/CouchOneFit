import type { RequestHandler } from 'express';
import type { Pool } from 'pg';

export function checkQuotaMiddleware(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).user?.id;

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

      if (sub.sub_status !== 'active') {
        res.status(403).json({ 
          code: 'SUBSCRIPTION_INACTIVE', 
          error: 'Se requiere una suscripción activa para realizar esta acción.' 
        });
        return;
      }

      if (sub.max_clients === null) {
        (req as any).professionalId = sub.professional_id;
        next();
        return;
      }

      const { rows: [{ count }] } = await pool.query<{ count: string }>(
        `SELECT count(*)::int AS count 
         FROM private.clients 
         WHERE professional_id = $1 AND status = 'active'`,
        [sub.professional_id]
      );

      const usedClients = parseInt(count, 10);

      if (usedClients >= sub.max_clients) {
        res.status(409).json({
          code: 'CUPO_AGOTADO',
          error: 'Has alcanzado el límite de clientes activos permitido por tu plan.',
          limit: sub.max_clients,
          used: usedClients
        });
        return;
      }

      (req as any).professionalId = sub.professional_id;
      next();
    } catch (error) {
      console.error('Error al verificar cupo:', error);
      next(error);
    }
  };
}