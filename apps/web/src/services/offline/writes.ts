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
  send: (headers: Record<string, string>) => Promise<T>
): Promise<WriteOutcome<T>> {
  const id = crypto.randomUUID();
  try {
    return { status: 'done', result: await send({ 'Idempotency-Key': id }) };
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    const operation = await enqueue({ ...spec, id });
    if (!operation) throw error;
    return { status: 'queued', operation };
  }
}
