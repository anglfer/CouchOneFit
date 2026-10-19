import type { ReactElement, ReactNode } from 'react';
import { Link } from '../components/Link';
import { useLocation } from '../hooks/useLocation';
import { applyAppUpdate, installApp } from '../services/pwa';
import { usePwa } from '../hooks/usePwa';
import { Icon, type IconName } from '../components/Icon';
import ThemeToggle from '../components/ThemeToggle';
import { initials } from '../utils/personName';

export interface WorkspaceNavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface WorkspaceUser {
  name: string;
  detail: string;
}

interface Props {
  /** Área del sistema: «Panel profesional» o «Administración». */
  area: string;
  /** Título de la vista actual, mostrado en la cabecera. */
  pageTitle: string;
  navigation: WorkspaceNavItem[];
  user: WorkspaceUser | null;
  onLogout?: () => void;
  isLeaving?: boolean;
  children: ReactNode;
}

export default function WorkspaceLayout({
  area,
  pageTitle,
  navigation,
  user,
  onLogout,
  isLeaving = false,
  children,
}: Props): ReactElement {
  const { pathname } = useLocation();
  const { canInstall, isInstalled, needsRefresh, isOnline } = usePwa();
  const homeHref = navigation[0]?.href ?? '/';

  function isCurrent(href: string): boolean {
    return pathname.replace(/\/$/, '') === href.replace(/\/$/, '');
  }

  return (
    <div className="min-h-screen bg-[#eaeffd] dark:bg-[#050a1a] text-slate-900 dark:text-slate-100 flex flex-col md:grid md:grid-cols-[256px_minmax(0,1fr)] transition-colors">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-indigo-600 focus:rounded-lg focus:shadow-md"
        href="#workspace-content"
      >
        Saltar al contenido
      </a>

      {/* Sidebar fijo en escritorio */}
      <aside className="hidden md:flex flex-col gap-6 sticky top-0 h-screen p-4 overflow-y-auto bg-[#f6f8ff] dark:bg-[#081126] border-r border-indigo-100/80 dark:border-slate-800 transition-colors">
        <Link
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-indigo-50/60 dark:hover:bg-slate-800/60 transition-colors"
          to={homeHref}
          aria-label={`CouchOne Fit, ${area}`}
        >
          <img
            src="/pwa-192x192.png"
            alt=""
            width="36"
            height="36"
            className="rounded-lg shadow-xs"
          />
          <div className="grid leading-tight">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              CouchOne{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                Fit
              </strong>
            </span>
            <small className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {area}
            </small>
          </div>
        </Link>

        {navigation.length > 0 && (
          <nav className="flex flex-col gap-1" aria-label={area}>
            <span className="px-3.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Menú
            </span>
            {navigation.map(({ href, label, icon }) => {
              const active = isCurrent(href);
              return (
                <Link
                  key={href}
                  to={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'relative font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-md before:bg-indigo-600'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    name={icon}
                    className={
                      active
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400'
                    }
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-indigo-100/80 dark:border-slate-800">
          {canInstall && !isInstalled && (
            <button
              type="button"
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-slate-800/60 transition-colors w-full text-left"
              onClick={() => void installApp()}
            >
              <Icon name="download" size={16} />
              <span>Instalar app</span>
            </button>
          )}
          <a
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/60 dark:hover:bg-slate-800/60 transition-colors w-full"
            href="/"
            target="_blank"
            rel="noopener"
          >
            <Icon name="external" size={16} />
            <span>Sitio público</span>
          </a>
          {user && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <span
                className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {initials(user.name)}
              </span>
              <div className="grid leading-tight min-w-0">
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user.name}
                </strong>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user.detail}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Cuerpo principal */}
      <div className="flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 px-6 flex items-center justify-between bg-white/90 dark:bg-[#0c152c]/90 backdrop-blur-md border-b border-indigo-100/80 dark:border-slate-800 transition-colors">
          <Link
            className="md:hidden flex items-center gap-2"
            to={homeHref}
            aria-label={`CouchOne Fit, ${area}`}
          >
            <img
              src="/pwa-192x192.png"
              alt=""
              width="30"
              height="30"
              className="rounded-lg"
            />
          </Link>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {area}
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              {pageTitle}
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            {onLogout && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                onClick={onLogout}
                disabled={isLeaving}
                aria-label={isLeaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
              >
                <Icon name="logout" size={16} />
                <span>{isLeaving ? 'Cerrando…' : 'Cerrar sesión'}</span>
              </button>
            )}
          </div>
        </header>

        {(!isOnline || needsRefresh) && (
          <div className="p-4 space-y-2">
            {!isOnline && (
              <p
                className="p-3 rounded-xl text-xs font-semibold text-amber-900 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-2"
                role="status"
              >
                <Icon name="wifi-off" size={16} />
                Sin conexión. Los datos se actualizarán cuando vuelvas a
                conectarte.
              </p>
            )}
            {needsRefresh && (
              <p
                className="p-3 rounded-xl text-xs font-semibold text-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2"
                role="status"
              >
                <span className="flex items-center gap-2">
                  <Icon name="sparkle" size={16} />
                  Hay una nueva versión de CouchOne Fit disponible.
                </span>
                <button
                  type="button"
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                  onClick={applyAppUpdate}
                >
                  Actualizar
                </button>
              </p>
            )}
          </div>
        )}

        <main
          id="workspace-content"
          className="p-6 sm:p-8 max-w-6xl mx-auto w-full pb-24 md:pb-10 focus:outline-none"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Tabbar móvil en la parte inferior */}
      {navigation.length > 1 && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0c152c] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2"
          aria-label={`${area} (móvil)`}
        >
          {navigation.map(({ href, label, icon }) => {
            const active = isCurrent(href);
            return (
              <Link
                key={href}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
