import type { ReactElement, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '../components/Link';
import { useLocation } from '../hooks/useLocation';
import { applyAppUpdate, installApp } from '../services/pwa';
import { usePwa } from '../hooks/usePwa';
import { useOfflineData } from '../hooks/useOfflineData';
import { useOperations } from '../hooks/useOperations';
import { startOutboxSync } from '../services/offline/sync';
import { useThemePreference } from '../hooks/useThemePreference';
import type { ThemePreference } from '../services/theme';
import { Icon, type IconName } from '../components/Icon';
import { initials } from '../utils/personName';
import { timeAgo } from '../utils/timeAgo';

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
  /** Destinos de uso diario: barra lateral y navegación móvil. */
  navigation: WorkspaceNavItem[];
  /** Destinos de cuenta y configuración: viven en el menú de la cuenta. */
  accountMenu?: WorkspaceNavItem[];
  /** Si existe, el panel envía solo los cambios hechos sin conexión y muestra el contador. */
  pendingHref?: string;
  user: WorkspaceUser | null;
  onLogout?: () => void;
  isLeaving?: boolean;
  children: ReactNode;
}

const themes: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Oscuro', icon: 'moon' },
  { value: 'system', label: 'Sistema', icon: 'monitor' },
];

function isCurrentPath(pathname: string, href: string): boolean {
  return pathname.replace(/\/$/, '') === href.replace(/\/$/, '');
}

function AccountMenu({
  user,
  items,
  area,
  placement,
  onLogout,
  isLeaving,
}: {
  user: WorkspaceUser;
  items: WorkspaceNavItem[];
  area: string;
  placement: 'up' | 'down';
  onLogout?: () => void;
  isLeaving: boolean;
}): ReactElement {
  const { pathname } = useLocation();
  const { canInstall, isInstalled } = usePwa();
  const { preference, setPreference } = useThemePreference();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const menu = root.current?.querySelector<HTMLElement>('[role="menu"]');
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    function onPointerDown(event: PointerEvent): void {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const entries = [
        ...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
      ];
      if (entries.length === 0) return;
      event.preventDefault();
      const index = entries.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      entries[(index + step + entries.length) % entries.length].focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const position =
    placement === 'up'
      ? { bottom: 'calc(100% + 8px)', left: 0 }
      : { top: 'calc(100% + 8px)', right: 0 };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        className={
          placement === 'up'
            ? 'ws-account-trigger ws-plain'
            : 'ws-plain inline-flex items-center rounded-full'
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menú de cuenta de ${user.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ws-avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        {placement === 'up' && (
          <>
            <span className="grid min-w-0 flex-1 leading-tight">
              <strong className="truncate text-[13px] font-semibold">
                {user.name}
              </strong>
              <span className="truncate text-xs text-(--ws-muted)">
                {user.detail}
              </span>
            </span>
            <Icon
              name="settings"
              size={18}
              className="shrink-0 text-(--ws-muted)"
            />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Cuenta, ${area}`}
          className="ws-menu"
          data-placement={placement}
          style={position}
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <span className="ws-avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className="grid min-w-0 leading-tight">
              <strong className="truncate text-sm font-semibold">
                {user.name}
              </strong>
              <span className="truncate text-xs text-(--ws-muted)">
                {user.detail}
              </span>
            </span>
          </div>
          <div className="ws-menu-sep" role="separator" />

          {items.map(({ href, label, icon }) => (
            <Link
              key={href}
              to={href}
              role="menuitem"
              className="ws-menu-item"
              aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={icon} size={18} />
              {label}
            </Link>
          ))}

          <div className="ws-menu-sep" role="separator" />
          <div className="ws-menu-label" id={`${menuId}-theme`}>
            Apariencia
          </div>
          <div
            className="ws-segmented"
            role="group"
            aria-labelledby={`${menuId}-theme`}
          >
            {themes.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="ws-plain"
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {canInstall && !isInstalled && (
            <button
              type="button"
              role="menuitem"
              className="ws-menu-item ws-plain"
              onClick={() => {
                setOpen(false);
                void installApp();
              }}
            >
              <Icon name="download" size={18} />
              Instalar app
            </button>
          )}
          <a
            role="menuitem"
            className="ws-menu-item"
            href="/"
            target="_blank"
            rel="noopener"
          >
            <Icon name="external" size={18} />
            Sitio público
          </a>

          {onLogout && (
            <>
              <div className="ws-menu-sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="ws-menu-item ws-plain"
                data-danger=""
                disabled={isLeaving}
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                <Icon name="logout" size={18} />
                {isLeaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceLayout({
  area,
  pageTitle,
  navigation,
  accountMenu = [],
  pendingHref,
  user,
  onLogout,
  isLeaving = false,
  children,
}: Props): ReactElement {
  const { pathname } = useLocation();
  const { needsRefresh, isOnline } = usePwa();
  const { staleSince } = useOfflineData();
  const pending = useOperations();
  useEffect(() => (pendingHref ? startOutboxSync() : undefined), [pendingHref]);
  const showingSaved = !isOnline || staleSince !== null;
  const homeHref = navigation[0]?.href ?? '/';

  return (
    <div className="ws-app flex flex-col md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-indigo-700 focus:shadow-md"
        href="#workspace-content"
      >
        Saltar al contenido
      </a>

      <aside className="ws-sidebar sticky top-0 hidden h-svh flex-col gap-6 overflow-y-auto p-4 md:flex">
        <Link
          className="flex items-center gap-3 rounded-lg p-2 no-underline"
          to={homeHref}
          aria-label={`CouchOne Fit, ${area}`}
        >
          <img
            src="/pwa-192x192.png"
            alt=""
            width="36"
            height="36"
            className="rounded-lg"
          />
          <span className="grid leading-tight">
            <span className="text-base font-bold tracking-tight">
              CouchOne <strong className="text-(--ws-primary-fg)">Fit</strong>
            </span>
            <small className="text-xs font-medium text-(--ws-muted)">
              {area}
            </small>
          </span>
        </Link>

        {navigation.length > 0 && (
          <nav className="flex flex-col gap-1" aria-label={area}>
            {navigation.map(({ href, label, icon }) => (
              <Link
                key={href}
                to={href}
                className="ws-nav-link"
                aria-current={
                  isCurrentPath(pathname, href) ? 'page' : undefined
                }
              >
                <Icon name={icon} size={19} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        )}

        {user && (
          <div className="mt-auto border-t border-(--ws-border-subtle) pt-3">
            <AccountMenu
              user={user}
              items={accountMenu}
              area={area}
              placement="up"
              onLogout={onLogout}
              isLeaving={isLeaving}
            />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="ws-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            className="flex items-center gap-2 md:hidden"
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
          <p className="min-w-0 truncate text-[13px] text-(--ws-muted)">
            <span>{area}</span>
            <span aria-hidden="true"> / </span>
            <strong className="font-semibold text-(--ws-text)">
              {pageTitle}
            </strong>
          </p>
          {pendingHref && pending.length > 0 && (
            <Link
              to={pendingHref}
              className="ws-badge ml-auto no-underline"
              data-tone={
                pending.some((item) =>
                  ['failed', 'conflict', 'duplicate'].includes(item.state)
                )
                  ? 'warn'
                  : 'info'
              }
            >
              {pending.length} por enviar
            </Link>
          )}
          {user && (
            <div className="md:hidden">
              <AccountMenu
                user={user}
                items={accountMenu}
                area={area}
                placement="down"
                onLogout={onLogout}
                isLeaving={isLeaving}
              />
            </div>
          )}
        </header>

        {(showingSaved || needsRefresh) && (
          <div className="space-y-2 px-4 pt-4 sm:px-8">
            {showingSaved && (
              <p
                className="ws-alert flex items-center gap-2"
                data-tone="warn"
                role="status"
              >
                <Icon name="wifi-off" size={16} className="mt-0.5 shrink-0" />
                <span>
                  Sin conexión. Puedes seguir consultando y registrando
                  {staleSince !== null &&
                    ` (datos guardados ${timeAgo(staleSince)})`}
                  ; los cambios se enviarán al volver la conexión.
                </span>
              </p>
            )}
            {needsRefresh && (
              <p
                className="ws-alert flex items-center justify-between gap-2"
                role="status"
              >
                <span className="flex items-center gap-2">
                  <Icon name="sparkle" size={16} />
                  Hay una nueva versión de CouchOne Fit disponible.
                </span>
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
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
          className="ws-content mx-auto w-full max-w-6xl p-4 pb-24 focus:outline-none sm:p-8 md:pb-10"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {navigation.length > 1 && (
        <nav
          className="ws-topbar fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around px-2 md:hidden"
          style={{
            borderBottom: 0,
            borderTop: '1px solid var(--ws-border-subtle)',
          }}
          aria-label={`${area} (móvil)`}
        >
          {navigation.map(({ href, label, icon }) => {
            const active = isCurrentPath(pathname, href);
            return (
              <Link
                key={href}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-3 text-xs font-medium no-underline ${
                  active
                    ? 'font-bold text-(--ws-primary-fg)'
                    : 'text-(--ws-muted)'
                }`}
              >
                <Icon name={icon} size={21} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
