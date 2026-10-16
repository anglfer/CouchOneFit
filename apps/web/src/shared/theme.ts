import { useSyncExternalStore } from 'react';

/**
 * Tema de la aplicación Web.
 * - Marketing, acceso y registro: siempre claro.
 * - Sistema interno (/app, /admin): preferencia del profesional/admin
 *   (claro, oscuro o seguir al sistema), guardada en este dispositivo.
 *
 * index.html replica `applyTheme` antes de cargar React para evitar parpadeo;
 * si cambias la clave o las rutas, actualiza también ese script.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'couchonefit-theme';
const BROWSER_COLORS = {
  marketing: '#4037f7',
  light: '#ffffff',
  dark: '#0c152c',
} as const;

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isPreference(saved)) return saved;
  } catch {
    // Almacenamiento bloqueado: se usa la preferencia del sistema.
  }
  return 'system';
}

let preference = readStoredPreference();

export function isWorkspacePath(pathname = window.location.pathname): boolean {
  return /^\/(app|admin)(\/|$)/.test(pathname);
}

function resolve(value: ThemePreference): ResolvedTheme {
  if (value !== 'system') return value;
  return systemDark.matches ? 'dark' : 'light';
}

function applyTheme(): void {
  const inWorkspace = isWorkspacePath();
  const theme = inWorkspace ? resolve(preference) : 'light';
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      inWorkspace ? BROWSER_COLORS[theme] : BROWSER_COLORS.marketing
    );
}

function notify(): void {
  applyTheme();
  listeners.forEach((listener) => listener());
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Con almacenamiento bloqueado la elección dura mientras la página siga abierta.
  }
  notify();
}

systemDark.addEventListener('change', () => {
  if (preference === 'system') notify();
});
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  preference = readStoredPreference();
  notify();
});
window.addEventListener('popstate', () => {
  applyTheme();
});
applyTheme();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePreference(): {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const current = useSyncExternalStore(subscribe, () => preference);
  const resolvedTheme = useSyncExternalStore(subscribe, () =>
    resolve(preference)
  );
  return {
    preference: current,
    resolvedTheme,
    setPreference: setThemePreference,
  };
}
