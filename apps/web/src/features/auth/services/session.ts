import { apiClient, ApiError } from '../../../services/api';

import type { Account, SessionResponse } from '../types/session';
let csrfPromise: Promise<string> | undefined;
let refreshPromise: Promise<SessionResponse> | undefined;

function csrf(): Promise<string> {
  csrfPromise ??= apiClient<{ csrfToken: string }>('/api/auth/csrf')
    .then((response) => response.csrfToken)
    .catch((error) => {
      csrfPromise = undefined;
      throw error;
    });
  return csrfPromise;
}
async function mutate<T>(endpoint: string, body: unknown = {}): Promise<T> {
  const token = await csrf();
  try {
    return await apiClient<T>(endpoint, {
      method: 'POST',
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
  identificador: string,
  contrasena: string
): Promise<SessionResponse> {
  return mutate('/api/auth/login', { identificador, contrasena });
}
function refresh(): Promise<SessionResponse> {
  if (!refreshPromise) {
    const renew = () => mutate<SessionResponse>('/api/auth/refresh');
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
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refresh();
    return apiClient<T>(endpoint);
  }
}
export const readSession = () =>
  sessionRequest<SessionResponse>('/api/auth/session');
export async function logout(): Promise<void> {
  // Esperar una renovación en curso evita volver a emitir cookies después del logout.
  await refreshPromise?.catch(() => undefined);
  await mutate<void>('/api/auth/logout');
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
