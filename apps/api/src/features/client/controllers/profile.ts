import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { readClientProfile, readClientRecord } from '../services/profile.js';

export function clientRecordController(pool: Pool, now?: () => Date): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { res.json({ record: await readClientRecord(pool, req.client!, req.query, now?.()) }); }
    catch (error) { next(error); }
  };
}

export function clientProfileController(pool: Pool, now?: () => Date): RequestHandler {
  return async (req, res, next) => {
    try {
      const profile = await readClientProfile(pool, req.client!, now?.());
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  };
}
