import { apiClient, ApiError } from '../../../services/api';

import type { Account, SessionResponse } from '../types/session';

const SESSION_CHANNEL = 'couchonefit-session';
const PRESERVED_LOCAL_STORAGE_KEYS = new Set(['cof-theme']);

let csrfPromise: Promise<string> | undefined;
let refreshPromise: Promise<SessionResponse> | undefined;

export async function clearSessionState(broadcast = true): Promise<void> {
  csrfPromise = undefined;
  refreshPromise = undefined;
  if (typeof window === 'undefined') return;
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
  method = 'POST'
): Promise<T> {
  const token = await csrf();
  try {
    return await apiClient<T>(endpoint, {
      method,
      headers: { 'X-CSRF-Token': token },
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
export async function sessionRequest<T>(endpoint: string): Promise<T> {
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
  expectedAccountId: string
): Promise<T> {
  try {
    return await mutate<T>(endpoint, body, method);
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
  method = 'POST'
): Promise<T> {
  try {
    return await mutate<T>(endpoint, body, method);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refresh();
    try {
      return await mutate<T>(endpoint, body, method);
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
