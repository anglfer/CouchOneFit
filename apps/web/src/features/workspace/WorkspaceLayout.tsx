import type { ReactElement, ReactNode } from 'react';
import ThemeToggle from '../../shared/ThemeToggle';
import './workspace.css';

interface Props {
  title: string;
  navigation: { href: string; label: string }[];
  sessionAction: ReactNode;
  children: ReactNode;
}

export default function WorkspaceLayout({
  title,
  navigation,
  sessionAction,
  children,
}: Props): ReactElement {
  return (
    <div className="workspace">
      <a className="workspace-skip" href="#workspace-content">
        Saltar al contenido
      </a>
      <aside className="workspace-sidebar">
        <a
          className="workspace-brand"
          href="/"
          aria-label="CouchOne Fit, inicio"
        >
          <img src="/logo.png" alt="" width="40" height="40" />
          <span>
            CouchOne <strong>Fit</strong>
          </span>
        </a>
        <p className="workspace-caption">{title}</p>
        <nav aria-label={title}>
          {navigation.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              aria-current={
                window.location.pathname.replace(/\/$/, '') ===
                href.replace(/\/$/, '')
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="workspace-public-link" href="/">
          Ir al sitio público ↗
        </a>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span>{title}</span>
          <div className="workspace-actions">
            <ThemeToggle />
            {sessionAction}
          </div>
        </header>
        <main
          id="workspace-content"
          className="workspace-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
