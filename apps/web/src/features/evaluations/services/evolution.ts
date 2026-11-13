import { freshRequest } from '../../auth/services/session';
import { ApiError } from '../../../services/api';
import { isConnectionFailure } from '../../../services/offline/connection';
import {
  rememberRead,
  recallRead,
  resolveAccountId,
  onAccountVerified,
  onOfflineCleared,
  invalidateEvaluationHistoryReads,
} from '../../../services/offline/readCache';
import {
  reportServedFromCache,
  reportFresh,
} from '../../../services/offline/status';
import { onSynced } from '../../../services/offline/sync';
import { isEvolutionPage, type EvolutionPage } from '../types/evolution';
import {
  validateEvolutionFilters,
  type EvolutionFilters,
} from '../utils/evolution';

let revision = 0,
  knownAccount: string | null = null,
  cacheSafe = true;
let invalidating = Promise.resolve();
onOfflineCleared(() => {
  revision++;
  knownAccount = null;
});
onAccountVerified((account) => {
  if (knownAccount !== account) {
    revision++;
    knownAccount = account;
  }
});
export function invalidateEvolutionReads(): void {
  revision++;
  cacheSafe = false;
  invalidating = invalidating
    .then(async () => {
      const account = await resolveAccountId();
      if (account) await invalidateEvaluationHistoryReads(account);
      cacheSafe = true;
    })
    .catch(() => {
      cacheSafe = false;
    });
}
onSynced(invalidateEvolutionReads);
export function evolutionEndpoint(
  clientId: string,
  filters: EvolutionFilters,
  cursor?: string
): string {
  const error = validateEvolutionFilters(filters);
  if (error) throw new ApiError(400, 'INVALID_INPUT', error);
  const q = new URLSearchParams();
  if (filters.from) q.set('from', filters.from);
  if (filters.to) q.set('to', filters.to);
  if (filters.method) q.set('method', filters.method);
  q.set('pageSize', '20');
  if (cursor) q.set('cursor', cursor);
  return `/api/clients/${encodeURIComponent(clientId)}/evaluation-history?${q}`;
}
export interface EvolutionRead {
  page: EvolutionPage;
  cachedAt: number | null;
}
export async function fetchEvolution(
  clientId: string,
  accountId: string,
  filters: EvolutionFilters,
  cursor: string | undefined,
  isCurrent: () => boolean
): Promise<EvolutionRead> {
  const endpoint = evolutionEndpoint(clientId, filters, cursor);
  await invalidating;
  const epoch = revision;
  const current = async () => {
    const account = await resolveAccountId();
    return (
      isCurrent() &&
      epoch === revision &&
      (account === null || account === accountId)
    );
  };
  const assertCurrent = async () => {
    if (!(await current()))
      throw new ApiError(
        401,
        'SESSION_CHANGED',
        'La cuenta o la consulta cambió. Vuelve a abrir el expediente.'
      );
  };
  const validate = (value: unknown): EvolutionPage => {
    if (
      !isEvolutionPage(value, clientId) ||
      value.period.from !== (filters.from || null) ||
      value.period.to !== (filters.to || null) ||
      value.method !== (filters.method || null) ||
      value.pageInfo.pageSize !== 20
    )
      throw new ApiError(
        502,
        'INVALID_EVOLUTION_RESPONSE',
        'No pudimos interpretar la evolución. Reintenta la consulta.'
      );
    return value;
  };
  await assertCurrent();
  let raw: unknown;
  try {
    raw = await freshRequest<unknown>(endpoint);
  } catch (error) {
    await assertCurrent();
    if (!isConnectionFailure(error)) throw error;
    if (!cacheSafe)
      throw new ApiError(
        0,
        'EVOLUTION_CACHE_INVALID',
        'Sin conexión: no pudimos actualizar la caché tras sincronizar. Reintenta con conexión.'
      );
    const saved = await recallRead<unknown>(endpoint, accountId);
    await assertCurrent();
    if (!saved)
      throw new ApiError(
        0,
        'EVOLUTION_NOT_CACHED',
        'Sin conexión: este periodo o página no está guardado en esta cuenta.'
      );
    const page = validate(saved.data);
    reportServedFromCache(saved.fetchedAt);
    return { page, cachedAt: saved.fetchedAt };
  }
  await assertCurrent();
  const page = validate(raw);
  await rememberRead(
    endpoint,
    page,
    accountId,
    () => isCurrent() && epoch === revision
  );
  await assertCurrent();
  reportFresh();
  return { page, cachedAt: null };
}
