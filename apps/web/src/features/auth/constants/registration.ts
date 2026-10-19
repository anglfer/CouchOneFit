export const NOTICE_VERSION = '2026-10-15.1';
export const REGISTRATION_NOTICE =
  'Al crear tu cuenta, guardamos tus datos de registro para identificarte y gestionar tu acceso a CouchOne Fit. Elegir un plan expresa tu interés y no activa una suscripción ni genera un cargo. Puedes completar tu perfil más adelante.';
export const registrationPlans = [
  {
    id: 'basic',
    name: 'Básico',
    price: 299,
    capacity: 'Hasta 10 clientes activos',
  },
  { id: 'pro', name: 'Pro', price: 599, capacity: 'Hasta 30 clientes activos' },
  { id: 'elite', name: 'Élite', price: 999, capacity: 'Clientes ilimitados' },
] as const;
