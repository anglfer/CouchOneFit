import { useRef, useState, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
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
    <header className="sticky top-0 z-40 bg-[#f8f9fd]/85 backdrop-blur-md border-b border-indigo-100/80 transition-colors">
      <div className="w-[min(1200px,calc(100%-48px))] mx-auto flex items-center justify-between min-h-[72px] gap-6">
        <Brand />

        <nav
          className="hidden md:flex items-center gap-1.5"
          aria-label="Navegación principal"
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-indigo-50/80 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-indigo-200/80 rounded-xl shadow-xs hover:border-indigo-500 hover:text-indigo-600 hover:bg-slate-50 transition-all"
            to="/acceso"
          >
            Acceso profesional <span aria-hidden="true">↗</span>
          </Link>
          <Link
            className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs shadow-indigo-600/30 hover:shadow-md hover:shadow-indigo-600/35 transition-all"
            to="/registro"
          >
            Contáctanos <span aria-hidden="true">→</span>
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          className="md:hidden inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl shadow-xs hover:bg-slate-50"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="marketing-navigation"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span>{isMenuOpen ? 'Cerrar' : 'Menú'}</span>
          <span className="flex flex-col gap-1 w-4" aria-hidden="true">
            <span
              className={`block h-0.5 bg-current rounded-full transition-transform ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}
            />
            <span
              className={`block h-0.5 bg-current rounded-full transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`}
            />
            <span
              className={`block h-0.5 bg-current rounded-full transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}
            />
          </span>
        </button>

        {isMenuOpen && (
          <nav
            id="marketing-navigation"
            className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-xl p-5 flex flex-col gap-4 z-50 animate-in fade-in duration-150"
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
                  className="px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              <Link
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100"
                to="/acceso"
                onClick={() => setIsMenuOpen(false)}
              >
                Acceso profesional <span aria-hidden="true">↗</span>
              </Link>
              <Link
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-600/30"
                to="/registro"
                onClick={() => setIsMenuOpen(false)}
              >
                Contáctanos <span aria-hidden="true">→</span>
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
