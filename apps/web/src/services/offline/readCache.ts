import { decryptJson, encryptJson, fingerprint } from './crypto';
import type { EncryptedPayload } from './crypto';
import { getStore } from './store';
import { reportFresh } from './status';

/** Caducidad de los datos locales (RNF23): 30 días desde la última lectura. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Solo lecturas del panel. Quedan fuera a propósito: soporte de administración
// (auditado), recuperación asistida, pagos e invitaciones (docs/architecture/pwa-offline.md §2.2).
const CACHEABLE = [
  /^\/api\/training\/(templates|exercises)(\?.*)?$/,
  /^\/api\/clients\/[^/?]+\/training-plans$/,
  /^\/api\/auth\/session$/,
  /^\/api\/admin\/session$/,
  /^\/api\/professional\/profile$/,
  /^\/api\/me\/subscription$/,
  /^\/api\/clients(\?.*)?$/,
  /^\/api\/clients\/[^/?]+(\/record)?$/,
  /^\/api\/admin\/plans$/,
  /^\/api\/admin\/professionals(\?.*)?$/,
];

export const isCacheableRead = (endpoint: string): boolean =>
  CACHEABLE.some((pattern) => pattern.test(endpoint));

interface Entry {
  fetchedAt: number;
  payload: EncryptedPayload;
}

export interface Recalled<T> {
  data: T;
  fetchedAt: number;
}

// Primera página de la cartera sin filtros: permite buscar y filtrar sin conexión.
const BASE_LIST = '/api/clients#base';

let activeAccountId: string | null = null;

const isClientList = (endpoint: string) => endpoint.startsWith('/api/clients?');

function params(endpoint: string): URLSearchParams {
  return new URLSearchParams(endpoint.slice(endpoint.indexOf('?') + 1));
}

export function isBaseClientList(endpoint: string): boolean {
  if (!isClientList(endpoint)) return false;
  const query = params(endpoint);
  return !query.get('search') && !query.get('status') && !query.get('cursor');
}

async function slot(endpoint: string, accountId: string) {
  const hash = await fingerprint(endpoint);
  return hash ? `${accountId}|${hash}` : null;
}

async function lastAccountId(): Promise<string | null> {
  const store = getStore();
  return store
    ? ((await store.get<string>('meta', 'lastAccountId')) ?? null)
    : null;
}

/** Cuenta con la que se guardan y leen los datos (verificada o la última conocida). */
export async function resolveAccountId(): Promise<string | null> {
  activeAccountId ??= await lastAccountId();
  return activeAccountId;
}

const clearedListeners = new Set<() => void>();
/** Avisa cuando se cierra la sesión local (para soltar el estado en memoria). */
export function onOfflineCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => clearedListeners.delete(listener);
}

type AccountListener = (accountId: string) => void;
const accountListeners = new Set<AccountListener>();
/** Avisa cuando el servidor confirma la cuenta (para cargar la bandeja de salida). */
export function onAccountVerified(listener: AccountListener): () => void {
  accountListeners.add(listener);
  return () => accountListeners.delete(listener);
}

/**
 * Cuenta verificada por el servidor. Si cambió, se descartan las lecturas guardadas de
 * la anterior; sus cambios pendientes (bandeja de salida) se conservan hasta enviarse.
 */
export async function noteAccount(accountId: string): Promise<void> {
  const store = getStore();
  if (!store) return;
  try {
    const last = await lastAccountId();
    if (last && last !== accountId) await store.clear(['readCache']);
    activeAccountId = accountId;
    await store.put('meta', 'lastAccountId', accountId);
    accountListeners.forEach((listener) => listener(accountId));
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch (error) {
    console.error(error);
  }
}

export async function rememberRead(
  endpoint: string,
  data: unknown
): Promise<void> {
  const store = getStore();
  const account = activeAccountId;
  if (!store || !account || !isCacheableRead(endpoint)) return;
  try {
    const payload = await encryptJson(store, account, data);
    if (!payload) return;
    const entry: Entry = { fetchedAt: Date.now(), payload };
    const key = await slot(endpoint, account);
    if (key) await store.put('readCache', key, entry);
    if (isBaseClientList(endpoint)) {
      const base = await slot(BASE_LIST, account);
      if (base) await store.put('readCache', base, entry);
    }
  } catch (error) {
    // Sin espacio o almacenamiento bloqueado: el uso sin conexión se degrada, la app no.
    console.error(error);
  }
}

async function read<T>(
  endpoint: string,
  account: string
): Promise<Recalled<T> | null> {
  const store = getStore();
  const key = await slot(endpoint, account);
  if (!store || !key) return null;
  const entry = await store.get<Entry>('readCache', key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > MAX_AGE_MS) {
    await store.delete('readCache', key);
    return null;
  }
  const data = await decryptJson<T>(store, account, entry.payload);
  return data === null ? null : { data, fetchedAt: entry.fetchedAt };
}

interface ListResponse {
  clients: { fullName?: unknown; goal?: unknown; status?: unknown }[];
  hasClients?: boolean;
  pageInfo?: Record<string, unknown>;
}

// shortcut: la lista derivada sale de la primera página guardada; si había más
// páginas, la búsqueda sin conexión no las ve. Subir cuando haya carteras grandes.
function deriveList<T>(endpoint: string, base: ListResponse): T | null {
  const query = params(endpoint);
  if (query.get('cursor')) return null;
  const search = (query.get('search') ?? '').trim().toLowerCase();
  const status = query.get('status') ?? '';
  const pageSize = Number(query.get('pageSize')) || 20;
  const matches = base.clients.filter((client) => {
    if (status && client.status !== status) return false;
    if (!search) return true;
    return `${client.fullName ?? ''} ${client.goal ?? ''}`
      .toLowerCase()
      .includes(search);
  });
  return {
    ...base,
    clients: matches.slice(0, pageSize),
    pageInfo: { pageSize, hasMore: false, nextCursor: null },
  } as unknown as T;
}

export async function recallRead<T>(
  endpoint: string
): Promise<Recalled<T> | null> {
  const store = getStore();
  if (!store || !isCacheableRead(endpoint)) return null;
  try {
    const account = await resolveAccountId();
    if (!account) return null;
    const exact = await read<T>(endpoint, account);
    if (exact) return exact;
    if (!isClientList(endpoint)) return null;
    const base = await read<ListResponse>(BASE_LIST, account);
    const derived = base && deriveList<T>(endpoint, base.data);
    return base && derived
      ? { data: derived, fetchedAt: base.fetchedAt }
      : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** ¿Hay una lectura guardada de hace menos de `maxAgeMs`? (para no repetir precargas). */
export async function hasRecentRead(
  endpoint: string,
  maxAgeMs: number
): Promise<boolean> {
  const account = activeAccountId;
  if (!account) return false;
  try {
    const key = await slot(endpoint, account);
    const entry = key
      ? await getStore()?.get<Entry>('readCache', key)
      : undefined;
    return !!entry && Date.now() - entry.fetchedAt < maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * Cierre de sesión o sesión inválida: borra las lecturas guardadas. Los cambios
 * pendientes de enviar (bandeja de salida) y sus claves se conservan, cifrados, hasta que
 * se envíen, caduquen o la persona los descarte (`everything`). Nunca se pierden en silencio.
 */
export async function clearOfflineData(everything = false): Promise<void> {
  activeAccountId = null;
  reportFresh();
  clearedListeners.forEach((listener) => listener());
  const store = getStore();
  if (!store) return;
  try {
    if (everything) await store.clear();
    else {
      await store.clear(['readCache']);
      await store.delete('meta', 'lastAccountId');
    }
  } catch (error) {
    console.error(error);
  }
}

/** Elimina lecturas caducadas (se llama al arrancar). */
export async function purgeExpired(): Promise<void> {
  const store = getStore();
  if (!store) return;
  try {
    for (const key of await store.keys('readCache')) {
      const entry = await store.get<Entry>('readCache', key);
      if (!entry || Date.now() - entry.fetchedAt > MAX_AGE_MS)
        await store.delete('readCache', key);
    }
  } catch (error) {
    console.error(error);
  }
}
