import { useEffect, useState, type ReactElement } from 'react';
import './theme.css';

type Theme = 'light' | 'dark';
const preference = window.matchMedia('(prefers-color-scheme: dark)');
let chosenTheme: Theme | null = null;
try {
  const saved = localStorage.getItem('couchonefit-theme');
  if (saved === 'light' || saved === 'dark') chosenTheme = saved;
} catch {
  // El cambio sigue disponible cuando el navegador bloquea almacenamiento.
}
document.documentElement.dataset.theme =
  chosenTheme ?? (preference.matches ? 'dark' : 'light');

export default function ThemeToggle(): ReactElement {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme as Theme
  );

  useEffect(() => {
    const followSystem = () => {
      if (chosenTheme) return;
      const next = preference.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    preference.addEventListener('change', followSystem);
    return () => preference.removeEventListener('change', followSystem);
  }, []);

  function toggle(): void {
    const next = theme === 'dark' ? 'light' : 'dark';
    chosenTheme = next;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem('couchonefit-theme', next);
    } catch {
      // Con almacenamiento bloqueado, conservar la elección durante esta página.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={
        theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      }
      title={
        theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
        )}
      </svg>
    </button>
  );
}
