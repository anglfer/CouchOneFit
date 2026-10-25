import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { readProfessionalSubscription } from '../services/subscription.js';

export function subscriptionController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const subscription = await readProfessionalSubscription(pool, req.professional!);
      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };
}