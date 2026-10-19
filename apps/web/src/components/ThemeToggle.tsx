import type { ReactElement } from 'react';
import { useThemePreference } from '../hooks/useThemePreference';
import { Icon } from './Icon';

/** Cambio rápido claro/oscuro en la cabecera del sistema interno. */
export default function ThemeToggle(): ReactElement {
  const { resolvedTheme, setPreference } = useThemePreference();
  const label =
    resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
      type="button"
      onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
