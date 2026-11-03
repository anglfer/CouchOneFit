import { useSyncExternalStore } from 'react';
import {
  getOfflineData,
  subscribeOfflineData,
  type OfflineDataState,
} from '../services/offline/status';

/** Desde cuándo son los datos que se están mostrando desde el almacén local. */
export function useOfflineData(): OfflineDataState {
  return useSyncExternalStore(subscribeOfflineData, getOfflineData);
}
