import { apiClient, ApiError } from '../../../services/api';
import { prefetchClientRecords } from '../../../services/offline/prefetch';
import {
  clearOfflineData,
  isBaseClientList,
  noteAccount,
  recallRead,
  rememberRead,
} from '../../../services/offline/readCache';
import { isConnectionFailure } from '../../../services/offline/connection';
import {
  reportFresh,
  reportServedFromCache,
} from '../../../services/offline/status';

import type { Account, SessionResponse } from '../types/session';

const SESSION_CHANNEL = 'couchonefit-session';
const PRESERVED_LOCAL_STORAGE_KEYS = new Set([
  'cof-theme',
  'couchonefit-theme',
]);

let csrfPromise: Promise<string> | undefined;
let refreshPromise: Promise<SessionResponse> | undefined;

export async function clearSessionState(broadcast = true): Promise<void> {
  csrfPromise = undefined;
  refreshPromise = undefined;
  if (typeof window === 'undefined') return;
  // Los datos guardados para uso sin conexión no sobreviven a la sesión (RNF23).
  await clearOfflineData();
  try {
    window.sessionStorage.clear();
  } catch (error) {
    console.error(error);
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!PRESERVED_LOCAL_STORAGE_KEYS.has(key)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error(error);
  }
  if ('caches' in window) {
    try {
      const names = await window.caches.keys();
      await Promise.all(
        names.map(async (name) => {
          const cache = await window.caches.open(name);
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter((request) =>
                new URL(
                  request.url,
                  window.location.origin
                ).pathname.startsWith('/api/')
              )
              .map((request) => cache.delete(request))
          );
        })
      );
    } catch (error) {
      console.error(error);
    }
  }
  if (broadcast && typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(SESSION_CHANNEL);
      channel.postMessage({ type: 'session-cleared' });
      channel.close();
    } catch (error) {
      console.error(error);
    }
  }
}

export function subscribeSessionCleared(onCleared: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => undefined;
  }
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL);
    const handler = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'session-cleared') {
        void clearSessionState(false);
        onCleared();
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  } catch (error) {
    console.error(error);
    return () => undefined;
  }
}

function csrf(): Promise<string> {
  csrfPromise ??= apiClient<{ csrfToken: string }>('/api/auth/csrf')
    .then((response) => response.csrfToken)
    .catch((error) => {
      csrfPromise = undefined;
      throw error;
    });
  return csrfPromise;
}
export async function mutate<T>(
  endpoint: string,
  body: unknown = {},
  method = 'POST',
  headers: Record<string, string> = {}
): Promise<T> {
  const token = await csrf();
  try {
    return await apiClient<T>(endpoint, {
      method,
      headers: { 'X-CSRF-Token': token, ...headers },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CSRF_INVALID')
      csrfPromise = undefined;
    throw error;
  }
}
export function login(
  identifier: string,
  password: string
): Promise<SessionResponse> {
  return mutate('/api/auth/login', { identifier, password });
}
function refresh(): Promise<SessionResponse> {
  if (!refreshPromise) {
    const renew = async () => {
      try {
        return await mutate<SessionResponse>('/api/auth/refresh');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSessionState();
        }
        throw error;
      }
    };
    refreshPromise = (
      navigator.locks
        ? navigator.locks.request('couchonefit-refresh', renew)
        : renew()
    ).finally(() => {
      refreshPromise = undefined;
    });
  }
  return refreshPromise;
}
async function loadAndRemember(endpoint: string): Promise<void> {
  await rememberRead(endpoint, await requestWithRefresh<unknown>(endpoint));
}

async function afterOnlineRead(endpoint: string, result: unknown) {
  if (endpoint === '/api/auth/session')
    await noteAccount((result as SessionResponse).account.id);
  await rememberRead(endpoint, result);
  reportFresh();
  if (isBaseClientList(endpoint)) {
    const clients = (result as { clients?: { id?: unknown }[] }).clients ?? [];
    prefetchClientRecords(
      clients.map((client) => String(client.id)),
      loadAndRemember
    );
  }
}

export async function sessionRequest<T>(endpoint: string): Promise<T> {
  try {
    const result = await requestWithRefresh<T>(endpoint);
    const saving = afterOnlineRead(endpoint, result).catch(console.error);
    // La identidad se asienta antes de seguir: las demás lecturas se guardan a su nombre.
    if (endpoint === '/api/auth/session') await saving;
    return result;
  } catch (error) {
    if (isConnectionFailure(error)) {
      const saved = await recallRead<T>(endpoint);
      if (saved) {
        reportServedFromCache(saved.fetchedAt);
        return saved.data;
      }
    }
    throw error;
  }
}

/** Lectura siempre fresca (sin caer a lo guardado): para el motor de sincronización. */
export const freshRequest = <T>(endpoint: string): Promise<T> =>
  requestWithRefresh<T>(endpoint);

async function requestWithRefresh<T>(endpoint: string): Promise<T> {
  try {
    return await apiClient<T>(endpoint);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        ['ROLE_FORBIDDEN', 'ACCESS_DENIED'].includes(error.code)
      ) {
        await clearSessionState(false);
      }
      throw error;
    }
    await refresh();
    try {
      return await apiClient<T>(endpoint);
    } catch (retryError) {
      if (
        retryError instanceof ApiError &&
        (retryError.status === 401 ||
          (retryError.status === 403 &&
            ['ROLE_FORBIDDEN', 'ACCESS_DENIED'].includes(retryError.code)))
      ) {
        await clearSessionState();
      }
      throw retryError;
    }
  }
}
export const readSession = () =>
  sessionRequest<SessionResponse>('/api/auth/session');

// One explicit write only. Refresh may recover authentication, never replay the write.
export async function sessionMutationOnce<T>(
  endpoint: string,
  body: unknown,
  method: string,
  expectedAccountId: string,
  headers: Record<string, string> = {}
): Promise<T> {
  try {
    return await mutate<T>(endpoint, body, method, headers);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const renewed = await refresh();
      if (
        renewed.account.id !== expectedAccountId ||
        renewed.account.role !== 'professional'
      ) {
        await clearSessionState();
        throw new ApiError(
          401,
          'SESSION_REQUIRED',
          'La cuenta cambió. Inicia de nuevo la consulta.'
        );
      }
      throw new ApiError(
        401,
        'SESSION_RENEWED',
        'Sesión renovada. Revisa tus cambios y vuelve a pulsar Guardar.'
      );
    }
    if (error instanceof ApiError && error.code === 'ROLE_FORBIDDEN')
      await clearSessionState();
    throw error;
  }
}
export async function sessionMutation<T>(
  endpoint: string,
  body: unknown = {},
  method = 'POST',
  headers: Record<string, string> = {}
): Promise<T> {
  try {
    return await mutate<T>(endpoint, body, method, headers);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refresh();
    try {
      return await mutate<T>(endpoint, body, method, headers);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401)
        await clearSessionState();
      throw retryError;
    }
  }
}
export async function logout(): Promise<void> {
  // Wait for an in-flight refresh so it cannot reissue cookies after logout.
  await refreshPromise?.catch((error) => {
    console.error(error);
  });
  try {
    await mutate<void>('/api/auth/logout');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
  }
  await clearSessionState(true);
}

export function authorizedReturn(
  value: string | null,
  role: Account['role'] = 'professional'
): string {
  const base = role === 'admin' ? '/admin' : '/app';
  if (
    !value ||
    !value.startsWith(base) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 33 ||
        character.charCodeAt(0) === 127 ||
        character === '\\'
    )
  )
    return `${base}/`;
  try {
    const target = new URL(value, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      (target.pathname !== base && !target.pathname.startsWith(`${base}/`))
    )
      return `${base}/`;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return `${base}/`;
  }
}
