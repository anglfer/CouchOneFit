import { useRef, useState, type ReactElement } from 'react';

const navigation = [
  { href: '#producto', label: 'El producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#planes', label: 'Planes' },
];

export function Brand(): ReactElement {
  return (
    <a className="marketing-brand" href="/" aria-label="CouchOne Fit, inicio">
      <span className="marketing-brand-symbol" aria-hidden="true">
        <img src="/logo.png" alt="" width="1254" height="1254" />
      </span>
      <span>
        CouchOne<span className="brand-fit"> Fit</span>
      </span>
    </a>
  );
}

export function MarketingNavigation(): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  function closeMenu(): void {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <header className="marketing-header">
      <div className="marketing-container marketing-nav-row">
        <Brand />
        <button
          ref={menuButtonRef}
          className="marketing-menu-toggle"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="marketing-navigation"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span>{isMenuOpen ? 'Cerrar' : 'Menú'}</span>
          <span
            className={`menu-lines${isMenuOpen ? ' is-open' : ''}`}
            aria-hidden="true"
          />
        </button>
        <nav
          id="marketing-navigation"
          className={isMenuOpen ? 'is-open' : ''}
          aria-label="Navegación principal"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && isMenuOpen) {
              closeMenu();
            }
          }}
        >
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            className="marketing-button button-small button-secondary"
            href="/acceso"
            onClick={() => setIsMenuOpen(false)}
          >
            Acceso profesional <span aria-hidden="true">↗</span>
          </a>
          <a className="marketing-button button-small" href="/registro">
            Contáctanos <span aria-hidden="true">→</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
