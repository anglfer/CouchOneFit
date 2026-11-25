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
  const source = (error ?? {}) as Record<string, unknown>;
  const code = source.code;
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode: typeof code === 'string' ? code : undefined,
    constraint: source.constraint,
    table: source.table,
    message: error instanceof Error ? error.message : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  };
}
