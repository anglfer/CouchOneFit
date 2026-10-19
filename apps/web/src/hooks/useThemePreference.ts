import { useSyncExternalStore } from 'react';
import {
  subscribeTheme,
  getThemePreference,
  getResolvedTheme,
  setThemePreference,
  type ThemePreference,
  type ResolvedTheme,
} from '../services/theme';

export function useThemePreference(): {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const current = useSyncExternalStore(subscribeTheme, getThemePreference);
  const resolvedTheme = useSyncExternalStore(subscribeTheme, getResolvedTheme);
  return {
    preference: current,
    resolvedTheme,
    setPreference: setThemePreference,
  };
}
