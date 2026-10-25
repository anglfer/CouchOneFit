import type { Pool } from 'pg';

export interface SaasPlanInput {
  name: string;
  maxClients: number | null;
  priceMxn: number;
}

export interface SaasPlanUpdate extends SaasPlanInput {
  isActive: boolean;
}

export async function findPlans(pool: Pool) {
  const { rows } = await pool.query(
    `SELECT id, name, max_clients AS "maxClients", price_mxn AS "priceMxn", is_active AS "isActive" 
     FROM private.saas_plans 
     ORDER BY max_clients ASC NULLS LAST`
  );
  return rows;
}

export async function insertPlan(pool: Pool, data: SaasPlanInput) {
  const { rows: [plan] } = await pool.query(
    `INSERT INTO private.saas_plans (name, max_clients, price_mxn) 
     VALUES ($1, $2, $3) 
     RETURNING id, name, max_clients AS "maxClients", price_mxn AS "priceMxn", is_active AS "isActive"`,
    [data.name, data.maxClients, data.priceMxn]
  );
  return plan;
}

export async function updatePlan(pool: Pool, id: string, data: SaasPlanUpdate) {
  const { rows: [plan] } = await pool.query(
    `UPDATE private.saas_plans 
     SET name = $2, max_clients = $3, price_mxn = $4, is_active = $5, updated_at = clock_timestamp() 
     WHERE id = $1 
     RETURNING id, name, max_clients AS "maxClients", price_mxn AS "priceMxn", is_active AS "isActive"`,
    [id, data.name, data.maxClients, data.priceMxn, data.isActive]
  );
  return plan;
}