/**
 * Estado compartido del uso sin conexión: desde cuándo son los datos que se
 * están mostrando desde el almacén local (`null` = datos recién consultados).
 */
export interface OfflineDataState {
  /** Marca de tiempo (ms) de la lectura guardada más antigua que se mostró. */
  staleSince: number | null;
}

const listeners = new Set<() => void>();
let state: OfflineDataState = { staleSince: null };

function set(next: OfflineDataState): void {
  if (next.staleSince === state.staleSince) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function reportServedFromCache(fetchedAt: number): void {
  set({
    staleSince:
      state.staleSince === null
        ? fetchedAt
        : Math.min(state.staleSince, fetchedAt),
  });
}

export function reportFresh(): void {
  set({ staleSince: null });
}

export function subscribeOfflineData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfflineData(): OfflineDataState {
  return state;
}
