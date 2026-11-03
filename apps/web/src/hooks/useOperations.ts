import { useEffect, useSyncExternalStore } from 'react';
import {
  getOperations,
  subscribeOutbox,
  type Operation,
} from '../services/offline/outbox';
import { onSynced } from '../services/offline/sync';

/** Cambios hechos sin conexión que aún no se envían. */
export function useOperations(): Operation[] {
  return useSyncExternalStore(subscribeOutbox, getOperations);
}

/** Ejecuta `refresh` cuando se aplican cambios pendientes en el servidor. */
export function useOnSynced(refresh: () => void): void {
  useEffect(() => onSynced(refresh), [refresh]);
}
