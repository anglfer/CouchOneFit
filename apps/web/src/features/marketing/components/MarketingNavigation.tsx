import { useRef, useState, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';

const navigation = [
  { href: '#producto', label: 'Producto' },
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
    <header className="sticky top-0 z-40 border-b-[3px] border-(--sg-ink) bg-white">
      <div className="relative mx-auto flex h-[73px] w-full max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-8">
        <Brand />

        <nav
          className="hidden items-center gap-8 lg:flex"
          aria-label="Navegación principal"
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[15px] font-semibold text-(--sg-ink) underline-offset-[6px] decoration-(--sg-pink) decoration-[3px] hover:underline"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <Link
            className="text-[15px] font-semibold text-(--sg-ink) underline-offset-[6px] decoration-(--sg-pink) decoration-[3px] hover:underline"
            to="/acceso"
          >
            Iniciar sesión
          </Link>
          <Link
            className="sg-btn min-h-11! py-2!"
            data-variant="action"
            to="/registro"
          >
            Crear cuenta
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          className="inline-flex size-11 items-center justify-center border-[3px] border-(--sg-ink) bg-white text-(--sg-ink) lg:hidden"
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
            className="absolute left-0 top-full z-50 flex w-full flex-col border-b-[3px] border-(--sg-ink) bg-white px-4 pb-6 sm:px-8 lg:hidden"
            aria-label="Navegación móvil"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeMenu();
            }}
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="sg-display border-b-2 border-(--sg-ink) py-4 text-lg font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              <Link
                className="sg-btn"
                data-variant="line"
                to="/acceso"
                onClick={() => setIsMenuOpen(false)}
              >
                Iniciar sesión
              </Link>
              <Link
                className="sg-btn"
                data-variant="action"
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
