const SYSTEM_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
]);
const SQLSTATES = new Set(['57P01', '57P02', '57P03', '53300']);
const MESSAGE =
  /timeout exceeded when trying to connect|Connection terminated|Query read timeout|connect ECONNREFUSED/i;

export function isDatabaseUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string') {
    if (SYSTEM_CODES.has(code) || SQLSTATES.has(code) || code.startsWith('08'))
      return true;
  }
  // AggregateError (varias direcciones) guarda los códigos en cada causa.
  const nested = (error as { errors?: unknown }).errors;
  if (Array.isArray(nested) && nested.some(isDatabaseUnavailable)) return true;
  return typeof message === 'string' && MESSAGE.test(message);
}

export function errorFields(error: unknown): Record<string, unknown> {
  const { code, name, message } = (error ?? {}) as Record<string, unknown>;
  const timedOut =
    code === 'ETIMEDOUT' ||
    code === '57014' ||
    name === 'TimeoutError' ||
    (typeof message === 'string' && /timeout exceeded|query read timeout|statement timeout/i.test(message));
  const unavailable = isDatabaseUnavailable(error);
  return {
    errorName: typeof name === 'string' && /^[A-Za-z]{0,32}Error$/.test(name) ? name : undefined,
    errorCode: typeof code === 'string' && /^[A-Z0-9_]{3,40}$/.test(code) ? code : undefined,
    message: timedOut
      ? 'La operación superó su tiempo de espera.'
      : unavailable
        ? 'La conexión con la base de datos no está disponible.'
        : 'Ocurrió un error interno al ejecutar la operación.',
    ...(timedOut ? { outcome: 'timeout' } : {}),
  };
}
