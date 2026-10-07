import { useRef, useState, type ReactElement, type RefObject } from 'react';

interface MarketingNavigationProps {
  onOpenAccess: () => void;
}

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

export function MarketingNavigation({
  onOpenAccess,
}: MarketingNavigationProps): ReactElement {
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
          <button
            className="marketing-button button-small button-secondary"
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onOpenAccess();
            }}
          >
            Acceso profesional <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

export function AccessDialog({
  dialogRef,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
}): ReactElement {
  return (
    <dialog
      ref={dialogRef}
      className="marketing-access-dialog"
      aria-labelledby="access-title"
      aria-describedby="access-description"
    >
      <form method="dialog">
        <button
          className="dialog-close"
          aria-label="Cerrar aviso"
          type="submit"
        >
          ×
        </button>
        <span className="marketing-label">
          ESTAMOS CONSTRUYENDO COUCHONE FIT
        </span>
        <h2 id="access-title">Tu próximo espacio de trabajo.</h2>
        <p id="access-description">
          El acceso profesional, el registro y la contratación todavía no están
          disponibles. Por ahora puedes explorar una vista conceptual del
          producto.
        </p>
        <p>
          No necesitas crear una cuenta. Esta demostración no solicita ni guarda
          datos personales.
        </p>
        <button className="marketing-button" type="submit">
          Entendido <span aria-hidden="true">→</span>
        </button>
      </form>
    </dialog>
  );
}
