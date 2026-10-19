import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { readClientProfile } from '../services/profile.js';

export function clientProfileController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const profile = await readClientProfile(pool, req.client!);
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  };
}
