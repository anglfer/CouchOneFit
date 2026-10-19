import { useSyncExternalStore } from 'react';
import { subscribePwa, getPwaState, type PwaState } from '../services/pwa';

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribePwa, getPwaState);
}
