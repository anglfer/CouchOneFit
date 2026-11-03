import { useRef, useState, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';

const navigation = [
  { href: '#producto', label: 'El producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#planes', label: 'Planes' },
  { href: '#preguntas', label: 'Preguntas' },
];

export function MarketingNavigation(): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu(): void {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Brand />

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Navegación principal"
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            to="/acceso"
          >
            Iniciar sesión
          </Link>
          <Link
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            to="/registro"
          >
            Crear cuenta
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 lg:hidden"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="marketing-navigation"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <Icon name={isMenuOpen ? 'close' : 'menu'} size={22} />
        </button>

        {isMenuOpen && (
          <nav
            id="marketing-navigation"
            className="absolute left-0 top-full z-50 flex w-full flex-col gap-4 border-b border-slate-200 bg-white p-5 shadow-xl lg:hidden"
            aria-label="Navegación móvil"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && isMenuOpen) {
                closeMenu();
              }
            }}
          >
            <div className="flex flex-col gap-1">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3.5 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
              <Link
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50"
                to="/acceso"
                onClick={() => setIsMenuOpen(false)}
              >
                Iniciar sesión
              </Link>
              <Link
                className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-700"
                to="/registro"
                onClick={() => setIsMenuOpen(false)}
              >
                Crear cuenta
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
