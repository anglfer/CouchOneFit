import { AuthError } from '../../auth/types/errors.js';
import type { SaasPlanInput, SaasPlanUpdate } from '../repositories/plans.js';

export function validatePlanInput(input: unknown, isUpdate = false): SaasPlanInput | SaasPlanUpdate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AuthError(400, 'INVALID_INPUT', 'Datos inválidos.');
  }
  
  const body = input as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
const maxClients = body.maxClients !== undefined ? body.maxClients : body.limit;
const priceMxn = Number(body.priceMxn !== undefined ? body.priceMxn : body.price);

  if (!name || name.length < 3) {
    throw new AuthError(400, 'INVALID_INPUT', 'El nombre debe tener al menos 3 caracteres.');
  }
  if (maxClients !== null && (typeof maxClients !== 'number' || maxClients <= 0)) {
    throw new AuthError(400, 'INVALID_INPUT', 'El límite de clientes debe ser nulo (ilimitado) o un número mayor a 0.');
  }
  if (isNaN(priceMxn) || priceMxn < 0) {
    throw new AuthError(400, 'INVALID_INPUT', 'El precio debe ser un número válido.');
  }

  const result: any = { name, maxClients, priceMxn };

  if (isUpdate) {
    if (typeof body.isActive !== 'boolean') {
      throw new AuthError(400, 'INVALID_INPUT', 'El estado activo debe ser booleano.');
    }
    result.isActive = body.isActive;
  }

  return result;
}