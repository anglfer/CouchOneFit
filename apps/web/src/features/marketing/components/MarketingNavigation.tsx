import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';

const navigation = [
  { href: '#producto', id: 'producto', label: 'Producto' },
  { href: '#expediente', id: 'expediente', label: 'Expediente' },
  { href: '#como-funciona', id: 'como-funciona', label: 'Cómo funciona' },
  { href: '#planes', id: 'planes', label: 'Planes' },
  { href: '#preguntas', id: 'preguntas', label: 'Preguntas' },
];

export function MarketingNavigation(): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sections = navigation
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null);

    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(
            entry.target.id,
            entry.isIntersecting ? entry.intersectionRatio : 0
          );
        }

        let bestId = '';
        let bestRatio = 0;
        for (const item of navigation) {
          const ratio = ratios.get(item.id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = item.id;
          }
        }
        setActiveSection(bestRatio > 0 ? bestId : '');
      },
      {
        rootMargin: '-18% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75],
      }
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  function closeMenu(): void {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="mk-nav-shell sticky top-0 z-40">
      <div className="mk-nav-inner relative">
        <div className="mx-auto flex h-[68px] w-full max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
          <Brand />

          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Navegación principal"
          >
            {navigation.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#f1f0ff] font-semibold text-brand-primary'
                      : 'text-brand-muted hover:bg-brand-surface hover:text-brand-ink'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-brand-primary"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              className="rounded-lg px-3.5 py-2.5 text-[15px] font-semibold text-brand-ink transition-colors hover:bg-brand-surface"
              to="/acceso"
            >
              Iniciar sesión
            </Link>
            <Link
              className="mk-btn min-h-10! px-4! text-[15px]!"
              data-variant="primary"
              to="/registro"
            >
              Crear cuenta
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-brand-border bg-white text-brand-ink hover:bg-brand-surface lg:hidden"
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
              className="absolute left-0 top-full z-50 flex w-full flex-col gap-4 border-b border-brand-border bg-white p-4 shadow-[0_24px_40px_-24px_rgb(9_9_24/0.35)] sm:px-8 lg:hidden"
              aria-label="Navegación móvil"
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeMenu();
              }}
            >
              <div className="flex flex-col">
                {navigation.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-3 text-base font-medium text-brand-ink hover:bg-brand-surface"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="flex flex-col gap-2.5 border-t border-brand-border pt-4">
                <Link
                  className="mk-btn w-full"
                  data-variant="secondary"
                  to="/acceso"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Iniciar sesión
                </Link>
                <Link
                  className="mk-btn w-full"
                  data-variant="primary"
                  to="/registro"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Crear cuenta
                </Link>
              </div>
            </nav>
          )}
        </div>
        <div aria-hidden="true" className="mk-scroll-progress" />
      </div>
    </header>
  );
}
