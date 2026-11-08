import { ApiError } from '../api';
import { confirmDialog } from '../confirm';
import {
  freshRequest,
  sessionMutation,
} from '../../features/auth/services/session';
import { isConnectionFailure } from './connection';
import {
  getOperations,
  loadOutbox,
  removeOperation,
  subscribeOutbox,
  updateOperation,
  type Operation,
} from './outbox';

/**
 * Motor de sincronización (DEC-018, docs/architecture/pwa-offline.md §4.3 y §4.7).
 * Envía la bandeja en orden, de una en una. Un fallo de red lo detiene sin perder nada;
 * un rechazo del servidor deja el cambio en «fallido», «conflicto» o «posible duplicado»
 * para que la persona decida. Nunca se pisa ni se descarta algo en silencio.
 */

type Outcome = 'applied' | 'blocked' | 'offline' | 'stop';

const syncedListeners = new Set<() => void>();
/** Se avisa tras aplicar cambios en el servidor, para que las pantallas se refresquen. */
export function onSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

async function findDuplicates(
  operation: Operation
): Promise<{ id: string; fullName: string }[]> {
  const name = String(operation.body.fullName ?? '');
  const query = new URLSearchParams({
    search: name.trim(),
    status: '',
    pageSize: '20',
  });
  const { clients } = await freshRequest<{
    clients: { id: string; fullName: string }[];
  }>(`/api/clients?${query}`);
  return clients
    .filter((client) => normalize(client.fullName) === normalize(name))
    .map(({ id, fullName }) => ({ id, fullName }));
}

async function serverCopy(
  operation: Operation
): Promise<Record<string, unknown> | null> {
  if (operation.kind.startsWith('training.') && operation.readEndpoint) {
    try {
      const response = await freshRequest<{
        versions: Record<string, unknown>[];
        activeRevision: number;
        timeZone: string;
        clientRevision: number;
      }>(operation.readEndpoint);
      if (operation.kind === 'training.zone')
        return {
          timeZone: response.timeZone,
          revision: response.clientRevision,
        };
      const versionId =
        operation.body.versionId ??
        operation.endpoint.match(/\/versions\/([^/]+)/)?.[1];
      const version = response.versions.find((v) => v.id === versionId);
      return version
        ? {
            ...version,
            activeRevision: response.activeRevision,
            prescription: version,
          }
        : null;
    } catch {
      return null;
    }
  }
  if (!operation.clientId) return null;
  try {
    const { client } = await freshRequest<{
      client: Record<string, unknown>;
    }>(`/api/clients/${encodeURIComponent(operation.clientId)}`);
    return client;
  } catch {
    return null;
  }
}

// Lo que se reintenta solo guarda el motivo: un «Por enviar» sin explicación no se puede diagnosticar.
const retryLater = (error: unknown) =>
  `No se pudo enviar (${
    error instanceof ApiError
      ? `${error.status}: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error)
  }). Se reintentará solo.`;

async function settle(operation: Operation, error: unknown): Promise<Outcome> {
  if (isConnectionFailure(error)) {
    await updateOperation(operation.id, {
      state: 'pending',
      error: retryLater(error),
    });
    return 'offline';
  }
  if (error instanceof ApiError) {
    if (
      error.status === 409 &&
      ['CLIENT_RECORD_CONFLICT', 'TRAINING_CONFLICT'].includes(error.code)
    ) {
      await updateOperation(operation.id, {
        state: 'conflict',
        error: error.message,
        server: await serverCopy(operation),
      });
      return 'blocked';
    }
    if (
      error.status === 401 ||
      error.status >= 500 ||
      error.code === 'IDEMPOTENCY_IN_PROGRESS'
    ) {
      // Sesión vencida o servidor ocupado: se conserva y se reintenta más tarde.
      await updateOperation(operation.id, {
        state: 'pending',
        error: retryLater(error),
      });
      return 'stop';
    }
    await updateOperation(operation.id, {
      state: 'failed',
      error: error.message,
    });
    return 'blocked';
  }
  await updateOperation(operation.id, {
    state: 'pending',
    error: retryLater(error),
  });
  return 'stop';
}

async function attempt(operation: Operation): Promise<Outcome> {
  if (
    operation.kind === 'client.create' &&
    !operation.confirmedNew &&
    operation.attempts === 0
  ) {
    try {
      const matches = await findDuplicates(operation);
      if (matches.length) {
        await updateOperation(operation.id, { state: 'duplicate', matches });
        return 'blocked';
      }
    } catch (error) {
      if (isConnectionFailure(error)) return 'offline';
      // Cualquier otro fallo de la consulta no bloquea: decide el servidor al enviar.
    }
  }
  await updateOperation(operation.id, {
    state: 'syncing',
    attempts: operation.attempts + 1,
    error: undefined,
  });
  try {
    const response = await sessionMutation<unknown>(
      operation.endpoint,
      operation.body,
      operation.method,
      {
        'Idempotency-Key': operation.id,
      }
    );
    if (
      operation.kind === 'training.save' &&
      response &&
      typeof response === 'object' &&
      'version' in response
    ) {
      const version = response.version;
      if (
        version &&
        typeof version === 'object' &&
        'revision' in version &&
        typeof version.revision === 'number'
      ) {
        const next = getOperations().find(
          (op) =>
            op.entityKey === operation.entityKey &&
            op.dependsOn?.includes(operation.id) &&
            op.attempts === 0
        );
        if (next && typeof next.body.revision === 'number')
          await updateOperation(next.id, {
            body: { ...next.body, revision: version.revision },
          });
      }
    }
    await removeOperation(operation.id);
    return 'applied';
  } catch (error) {
    return settle(operation, error);
  }
}

async function run(): Promise<void> {
  if (navigator.onLine === false) return;
  const task = async () => {
    await loadOutbox();
    let changed = false;
    for (const operation of getOperations().filter(
      (item) => item.state === 'pending'
    )) {
      if (
        operation.dependsOn?.some((id) =>
          getOperations().some((op) => op.id === id)
        )
      )
        continue;
      const latest = getOperations().find((item) => item.id === operation.id);
      if (!latest || latest.state !== 'pending') continue;
      const outcome = await attempt(latest);
      if (outcome === 'applied') changed = true;
      if (outcome === 'offline' || outcome === 'stop') break;
    }
    if (changed) syncedListeners.forEach((listener) => listener());
  };
  // Una sola pestaña envía a la vez; la clave de idempotencia cubre el resto.
  if (typeof navigator !== 'undefined' && navigator.locks)
    await navigator.locks.request('couchonefit-outbox', task);
  else await task();
}

let flushing: Promise<void> | null = null;
let again = false;
export function flushOutbox(): Promise<void> {
  // Una pasada en curso no ve lo encolado después: se repite al terminar en vez de esperar 30 s.
  if (flushing) again = true;
  flushing ??= (async () => {
    do {
      again = false;
      await run().catch(console.error);
    } while (again);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Arranca el envío automático: al volver la conexión, al enfocar la app y cada 30 s. */
export function startOutboxSync(): () => void {
  const trigger = () => void flushOutbox();
  const timer = window.setInterval(() => {
    if (getOperations().some((item) => item.state === 'pending')) trigger();
  }, 30_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') trigger();
  };
  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', onVisible);
  const stop = subscribeOutbox(() => undefined);
  void loadOutbox().then(trigger);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', trigger);
    window.removeEventListener('focus', trigger);
    document.removeEventListener('visibilitychange', onVisible);
    stop();
  };
}

const find = (id: string) => getOperations().find((item) => item.id === id);

/** Fallido → vuelve a intentarlo. */
export async function retryOperation(id: string): Promise<void> {
  await updateOperation(id, { state: 'pending', error: undefined });
  await flushOutbox();
}

/** Quita el cambio pendiente sin enviarlo (lo decide la persona). */
export async function discardOperation(id: string): Promise<void> {
  // Lo encadenado se armó sobre este cambio: sin él, el servidor lo rechaza siempre (404/409).
  const dependents = getOperations().filter((op) => op.dependsOn?.includes(id));
  if (
    dependents.length &&
    !(await confirmDialog({
      title: '¿Descartar también los cambios que dependen de este?',
      message: `${dependents.length === 1 ? 'Hay 1 cambio posterior' : `Hay ${dependents.length} cambios posteriores`} de esta rutina que no pueden enviarse sin este. Se descartarán juntos.`,
      confirmLabel: 'Descartar todo',
      cancelLabel: 'Conservar',
      danger: true,
    }))
  )
    return;
  for (const operation of dependents) await removeOperation(operation.id);
  await removeOperation(id);
}

/** Conflicto → se conserva lo del servidor y se descarta el cambio local. */
export const keepServerVersion = discardOperation;

/** Conflicto → se reaplica el cambio local sobre la versión actual del servidor. */
export async function reapplyOnServerVersion(id: string): Promise<void> {
  const operation = find(id);
  if (!operation) return;
  const server = operation.server ?? (await serverCopy(operation));
  if (operation.kind.startsWith('training.')) {
    if (
      !server ||
      typeof server.revision !== 'number' ||
      (server.published === true && operation.kind === 'training.save')
    ) {
      await updateOperation(id, {
        error:
          'La versión ya está publicada o no está disponible. Abre Entrenamiento y crea un borrador nuevo; tu captura sigue aquí.',
      });
      return;
    }
    await updateOperation(id, {
      body: {
        ...operation.body,
        revision: server.revision,
        ...(operation.kind === 'training.activate'
          ? { activeRevision: server.activeRevision }
          : {}),
      },
      server,
      state: 'pending',
      error: undefined,
    });
    await flushOutbox();
    return;
  }
  if (!server || typeof server.version !== 'number') {
    await updateOperation(id, {
      error: 'No pudimos consultar la versión actual. Inténtalo con conexión.',
    });
    return;
  }
  if (
    operation.kind === 'client.status' &&
    server.status === operation.body.status
  ) {
    await removeOperation(id);
    syncedListeners.forEach((listener) => listener());
    return;
  }
  await updateOperation(id, {
    body: { ...operation.body, version: server.version },
    server,
    state: 'pending',
    error: undefined,
  });
  await flushOutbox();
}

/** Posible duplicado → «es otra persona»: se crea de todos modos. */
export async function confirmNotDuplicate(id: string): Promise<void> {
  await updateOperation(id, {
    confirmedNew: true,
    state: 'pending',
    matches: undefined,
    error: undefined,
  });
  await flushOutbox();
}

/** Posible duplicado → «es la misma persona»: se descarta el pendiente. */
export const dismissDuplicate = discardOperation;
