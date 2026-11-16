import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../../../services/api';
import { onSynced } from '../../../services/offline/sync';
import {
  onAccountVerified,
  onOfflineCleared,
} from '../../../services/offline/readCache';
import { fetchEvolution } from '../services/evolution';
import type {
  EvolutionMetric,
  EvolutionPage,
  EvolutionSample,
} from '../types/evolution';
import {
  mergeEvolutionSamples,
  type EvolutionFilters,
} from '../utils/evolution';

interface State {
  key: string;
  page: EvolutionPage | null;
  samples: EvolutionSample[];
  loading: boolean;
  loadingMore: boolean;
  error: string;
  denied: boolean;
  cachedAt: number | null;
}
const empty = (key: string): State => ({
  key,
  page: null,
  samples: [],
  loading: false,
  loadingMore: false,
  error: '',
  denied: false,
  cachedAt: null,
});
export function useEvolution(
  clientId: string,
  accountId: string,
  filters: EvolutionFilters,
  metric: EvolutionMetric,
  enabled: boolean
) {
  const key = JSON.stringify([clientId, accountId, filters, metric]);
  const currentKey = useRef(key);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key]);
  const generation = useRef(0),
    busy = useRef(false),
    blocked = useRef(false);
  const [attempt, setAttempt] = useState(0),
    [stored, setStored] = useState<State>(() => empty(key));
  const visible =
    stored.key === key
      ? stored
      : stored.denied
        ? { ...empty(key), denied: true, error: stored.error }
        : { ...empty(key), loading: enabled };
  const invalidate = useCallback(() => {
    generation.current++;
    busy.current = false;
  }, []);
  const reload = useCallback(() => {
    invalidate();
    blocked.current = false;
    setAttempt((n) => n + 1);
  }, [invalidate]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      busy.current = false;
      blocked.current = true;
      setStored({
        ...empty(currentKey.current),
        denied: true,
        error: 'La sesión cambió. Vuelve a abrir el expediente.',
      });
    };
    const off = onOfflineCleared(clear);
    const account = onAccountVerified((id) => {
      if (id !== accountId) clear();
      else if (blocked.current) reload();
    });
    const sync = onSynced(() => {
      if (!blocked.current) reload();
    });
    const online = () => {
      if (!blocked.current) reload();
    };
    window.addEventListener('online', online);
    return () => {
      off();
      account();
      sync();
      window.removeEventListener('online', online);
    };
  }, [accountId, reload]);
  useEffect(() => {
    if (!enabled || blocked.current) return;
    const epoch = ++generation.current;
    const current = () =>
      generation.current === epoch && currentKey.current === key;
    busy.current = true;
    setStored({ ...empty(key), loading: true });
    void fetchEvolution(clientId, accountId, filters, undefined, current)
      .then((result) => {
        if (current())
          setStored({
            ...empty(key),
            page: result.page,
            samples: result.page.samples,
            cachedAt: result.cachedAt,
          });
      })
      .catch((error) => {
        if (!current()) return;
        const denied =
          error instanceof ApiError && [401, 403, 404].includes(error.status);
        if (denied) blocked.current = true;
        setStored({
          ...empty(key),
          denied,
          error:
            error instanceof Error
              ? error.message
              : 'No pudimos consultar la evolución.',
        });
      })
      .finally(() => {
        if (current()) busy.current = false;
      });
    return invalidate;
  }, [key, enabled, attempt, clientId, accountId, filters, invalidate]);
  async function more() {
    if (
      busy.current ||
      blocked.current ||
      !visible.page?.pageInfo.hasMore ||
      !visible.page.pageInfo.nextCursor
    )
      return;
    const epoch = generation.current,
      current = () =>
        generation.current === epoch && currentKey.current === key;
    busy.current = true;
    setStored((s) => ({ ...s, loadingMore: true, error: '' }));
    try {
      const result = await fetchEvolution(
        clientId,
        accountId,
        filters,
        visible.page.pageInfo.nextCursor,
        current
      );
      if (current())
        setStored((s) => ({
          ...s,
          page: result.page,
          samples: mergeEvolutionSamples(s.samples, result.page.samples),
          loadingMore: false,
          cachedAt:
            s.cachedAt === null
              ? result.cachedAt
              : result.cachedAt === null
                ? s.cachedAt
                : Math.min(s.cachedAt, result.cachedAt),
        }));
    } catch (error) {
      if (!current()) return;
      const denied =
        error instanceof ApiError && [401, 403, 404].includes(error.status);
      if (denied) {
        blocked.current = true;
        setStored({ ...empty(key), denied: true, error: error.message });
      } else
        setStored((s) => ({
          ...s,
          loadingMore: false,
          error:
            error instanceof Error
              ? error.message
              : 'No pudimos consultar otra página.',
        }));
    } finally {
      if (current()) busy.current = false;
    }
  }
  return { ...visible, reload, more };
}
