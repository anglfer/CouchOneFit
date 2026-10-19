import { useSyncExternalStore } from 'react';
import { subscribeNavigation } from '../utils/navigation';

export function useLocation(): {
  pathname: string;
  search: string;
  hash: string;
} {
  const pathname = useSyncExternalStore(
    subscribeNavigation,
    () => window.location.pathname
  );

  return {
    pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}
