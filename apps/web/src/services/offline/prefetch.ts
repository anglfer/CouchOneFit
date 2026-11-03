import { hasRecentRead } from './readCache';
import { getStore } from './store';

const MAX_RECORDS = 25;
const FRESH_MS = 10 * 60 * 1000;
const STEP_MS = 300;

let running = false;

/**
 * Tras listar la cartera con conexión, guarda en segundo plano los expedientes
 * de los primeros clientes para poder abrirlos sin conexión. Es mejor esfuerzo:
 * se detiene al perder la conexión y nunca muestra errores.
 */
export function prefetchClientRecords(
  clientIds: string[],
  load: (endpoint: string) => Promise<void>
): void {
  if (!getStore() || running || typeof window === 'undefined') return;
  running = true;
  const queue = clientIds.slice(0, MAX_RECORDS);

  const next = async (): Promise<void> => {
    const id = queue.shift();
    if (!id || navigator.onLine === false) {
      running = false;
      return;
    }
    const endpoint = `/api/clients/${encodeURIComponent(id)}/record`;
    try {
      if (!(await hasRecentRead(endpoint, FRESH_MS))) await load(endpoint);
    } catch {
      // Mejor esfuerzo: un expediente que falle no detiene a los demás.
    }
    window.setTimeout(() => void next(), STEP_MS);
  };
  window.setTimeout(() => void next(), 1500);
}
