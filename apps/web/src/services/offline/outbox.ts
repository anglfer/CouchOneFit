import { decryptJson, encryptJson, type EncryptedPayload } from './crypto';
import {
  MAX_AGE_MS,
  onAccountVerified,
  onOfflineCleared,
  resolveAccountId,
} from './readCache';
import { getStore } from './store';

/**
 * Bandeja de salida (DEC-018, docs/architecture/pwa-offline.md §4.3): escrituras hechas
 * sin conexión, cifradas por cuenta, que se envían al volver la conexión. El `id` es
 * también la `Idempotency-Key`: enviarla otra vez nunca duplica ni reaplica el cambio.
 */

export type OperationKind = 'client.create' | 'client.edit' | 'client.status';
export type OperationState =
  'pending' | 'syncing' | 'failed' | 'conflict' | 'duplicate';

export interface Operation {
  id: string;
  accountId: string;
  kind: OperationKind;
  method: 'POST' | 'PATCH';
  endpoint: string;
  body: Record<string, unknown>;
  /** Texto para la persona: «Crear expediente de Ana Torres». */
  label: string;
  /** Expediente al que se refiere (edición o estado); `null` al crear. */
  clientId: string | null;
  clientName: string | null;
  createdAt: number;
  state: OperationState;
  attempts: number;
  error?: string;
  /** Posible duplicado: expedientes del servidor con el mismo nombre. */
  matches?: { id: string; fullName: string }[];
  /** La persona confirmó que no es un duplicado. */
  confirmedNew?: boolean;
  /** Conflicto: copia actual del servidor. */
  server?: Record<string, unknown> | null;
}

export type OperationSpec = Pick<
  Operation,
  | 'id'
  | 'kind'
  | 'method'
  | 'endpoint'
  | 'body'
  | 'label'
  | 'clientId'
  | 'clientName'
>;

interface Stored {
  accountId: string;
  createdAt: number;
  payload: EncryptedPayload;
}

const listeners = new Set<() => void>();
let current: Operation[] = [];
let loadedFor: string | null = null;

const keyOf = (accountId: string, id: string) => `${accountId}|${id}`;

function publish(next: Operation[]): void {
  current = next;
  listeners.forEach((listener) => listener());
}

export const subscribeOutbox = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getOperations = (): Operation[] => current;

async function persist(operation: Operation): Promise<void> {
  const store = getStore();
  if (!store) return;
  const payload = await encryptJson(store, operation.accountId, operation);
  if (!payload) throw new Error('No se pudo cifrar el cambio pendiente.');
  const entry: Stored = {
    accountId: operation.accountId,
    createdAt: operation.createdAt,
    payload,
  };
  await store.put('outbox', keyOf(operation.accountId, operation.id), entry);
}

/** Carga (o recarga) la bandeja de la cuenta. Las enviándose de una pestaña caída vuelven a pendientes. */
export async function loadOutbox(accountId?: string | null): Promise<void> {
  const store = getStore();
  const account = accountId ?? (await resolveAccountId());
  if (!store || !account) return;
  try {
    const loaded: Operation[] = [];
    for (const key of await store.keys('outbox')) {
      if (!key.startsWith(`${account}|`)) continue;
      const entry = await store.get<Stored>('outbox', key);
      if (!entry) continue;
      if (Date.now() - entry.createdAt > MAX_AGE_MS) {
        await store.delete('outbox', key);
        continue;
      }
      const operation = await decryptJson<Operation>(
        store,
        account,
        entry.payload
      );
      if (operation)
        loaded.push(
          operation.state === 'syncing'
            ? { ...operation, state: 'pending' }
            : operation
        );
    }
    loadedFor = account;
    publish(loaded.sort((a, b) => a.createdAt - b.createdAt));
  } catch (error) {
    console.error(error);
  }
}

/** Guarda un cambio nuevo. Devuelve `null` si este dispositivo no puede guardar sin conexión. */
export async function enqueue(spec: OperationSpec): Promise<Operation | null> {
  const store = getStore();
  const accountId = await resolveAccountId();
  if (!store || !accountId) return null;
  if (loadedFor !== accountId) await loadOutbox(accountId);
  const operation: Operation = {
    ...spec,
    accountId,
    createdAt: Date.now(),
    state: 'pending',
    attempts: 0,
  };
  try {
    await persist(operation);
  } catch (error) {
    console.error(error);
    return null;
  }
  publish([...current, operation]);
  return operation;
}

export async function updateOperation(
  id: string,
  patch: Partial<Operation>
): Promise<Operation | null> {
  const existing = current.find((operation) => operation.id === id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await persist(next);
  publish(current.map((operation) => (operation.id === id ? next : operation)));
  return next;
}

export async function removeOperation(id: string): Promise<void> {
  const existing = current.find((operation) => operation.id === id);
  if (!existing) return;
  await getStore()?.delete('outbox', keyOf(existing.accountId, id));
  publish(current.filter((operation) => operation.id !== id));
}

/** Descarta todo lo pendiente de la cuenta y borra sus claves locales (acción explícita). */
export async function discardAllOperations(): Promise<void> {
  const store = getStore();
  if (!store) return;
  const account = loadedFor ?? (await resolveAccountId());
  if (account) {
    for (const key of await store.keys('outbox'))
      if (key.startsWith(`${account}|`)) await store.delete('outbox', key);
    await store.delete('meta', `key:${account}`);
  }
  publish([]);
}

export const pendingCount = (): number => current.length;

// Al confirmar la cuenta con el servidor se carga su bandeja.
onAccountVerified((accountId) => void loadOutbox(accountId));
onOfflineCleared(() => {
  loadedFor = null;
  publish([]);
});

/** Solo pruebas: olvida el estado en memoria. */
export function resetOutboxForTests(): void {
  loadedFor = null;
  current = [];
  listeners.clear();
}
