import type { Pool } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import { AuthError } from '../../auth/types/errors.js';
import { professionalSubscription, type SubscriptionDetails } from '../repositories/subscription.js';

export async function readProfessionalSubscription(
  pool: Pool,
  identity: SessionIdentity
): Promise<SubscriptionDetails> {
  const subscription = await professionalSubscription(pool, identity);
  if (!subscription) {
    throw new AuthError(
      401,
      'SESSION_REQUIRED',
      'Tu sesión venció. Inicia sesión de nuevo.'
    );
  }
  return subscription;
}