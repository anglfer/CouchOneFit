import { hash, argon2id } from 'argon2'
import type { Pool } from 'pg'
import { insertProfessional } from '../repositories/registration.js'
import { validateRegistration } from '../validators/registration.js'
import { RegistrationError } from '../types/registration.js'

export async function registerProfessional(pool: Pool, input: unknown) {
  const data = validateRegistration(input)
  try {
    const passwordHash = await hash(data.password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })
    const id = await insertProfessional(pool, data, passwordHash)
    return {
      account: {
        id,
        role: 'professional',
        status: 'active',
        subscription: null,
      },
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new RegistrationError(
        409,
        'IDENTIFIER_UNAVAILABLE',
        'El usuario o correo ya está registrado. Prueba con otro o ve al acceso.',
      )
    }
    throw new RegistrationError(
      503,
      'REGISTRATION_UNAVAILABLE',
      'No pudimos completar el registro. Inténtalo más tarde.',
    )
  }
}
