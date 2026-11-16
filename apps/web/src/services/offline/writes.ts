import { isConnectionFailure } from './connection';
import { enqueue, type Operation, type OperationSpec } from './outbox';

export type WriteOutcome<T> =
  { status: 'done'; result: T } | { status: 'queued'; operation: Operation };

/**
 * Escritura «primero en línea» (DEC-018): se envía de inmediato con una clave de
 * idempotencia. Si no hay conexión, el mismo cambio —con la misma clave— queda en la
 * bandeja de salida y se enviará solo; si el primer envío sí llegó y solo se perdió la
 * respuesta, el reintento devuelve el resultado original sin duplicar.
 *
 * Sin almacén local (navegador sin IndexedDB) vuelve a lanzar el error original: el
 * comportamiento previo a DEC-018.
 */
export async function submitWrite<T>(
  spec: Omit<OperationSpec, 'id'>,
  send: (headers: Record<string, string>) => Promise<T>,
  options: { id?: string; timeoutMs?: number } = {}
): Promise<WriteOutcome<T>> {
  const id = options.id ?? crypto.randomUUID();
  try {
    const request = send({ 'Idempotency-Key': id });
    // A deadline does not prove that the server rolled back. Preserve the same
    // operation key in the outbox; late responses/replays cannot duplicate it.
    const result = await awaitConfirmation(request, options.timeoutMs);
    return { status: 'done', result };
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    const operation = await enqueue({ ...spec, id });
    if (!operation) throw error;
    return { status: 'queued', operation };
  }
}

/** A bounded wait does not cancel the server transaction or change its idempotency key. */
export async function awaitConfirmation<T>(
  request: Promise<T>,
  timeoutMs?: number
): Promise<T> {
  if (timeoutMs === undefined) return request;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new TypeError(
                'El servidor no confirmó la operación dentro del tiempo de espera.'
              )
            ),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
