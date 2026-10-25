import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import AppearanceSettings from '../../../components/AppearanceSettings';
import { Icon } from '../../../components/Icon';
import InstallAppCard from '../../../components/InstallAppCard';
import { Link } from '../../../components/Link';
import { useLocation } from '../../../hooks/useLocation';
import type { WorkspaceNavItem } from '../../../layouts/WorkspaceLayout';
import WorkspaceLayout from '../../../layouts/WorkspaceLayout';
import { ApiError } from '../../../services/api';
import {
  logout,
  readSession,
  sessionRequest,
  subscribeSessionCleared,
} from '../../auth/services/session';
import type { Account } from '../../auth/types/session';
import RecoveryPanel from '../../auth/components/RecoveryPanel';
import PlanCatalog from '../components/PlanCatalog';
import ProfessionalDirectory from '../components/ProfessionalDirectory';

const navigation: WorkspaceNavItem[] = [
  { href: '/admin/', label: 'Inicio', icon: 'home' },
  { href: '/admin/profesionales', label: 'Profesionales', icon: 'user' },
  { href: '/admin/planes', label: 'Catálogo de Planes', icon: 'shield' },
  { href: '/admin/perfil', label: 'Mi cuenta', icon: 'shield' },
  {
    href: '/admin/recuperacion',
    label: 'Recuperación asistida',
    icon: 'shield',
  },
];

export default function AdminPage(): ReactElement {
  const { pathname: rawPath } = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const pathname = rawPath.replace(/\/$/, '') || '/admin';
  const isProfilePage = pathname === '/admin/perfil';
  const isHome = pathname === '/admin';
  const isRecoveryPage = pathname === '/admin/recuperacion';
  const isPlanesPage = pathname === '/admin/planes';
  const isProfesionalesPage = pathname === '/admin/profesionales';

  const knownRoute = isHome || isProfilePage || isRecoveryPage || isPlanesPage || isProfesionalesPage;

  useEffect(() => {
    let active = true;
    async function check(showLoading = false) {
      if (showLoading) setChecking(true);
      try {
        const session = await readSession();
        if (!active) return;
        if (session.account.role !== 'admin') {
          setAccount(null);
          window.location.replace('/app/');
          return;
        }
        const result = await sessionRequest<{ account: Account }>(
          '/api/admin/session'
        );
        if (active) {
          setAccount(result.account);
          setError('');
        }
      } catch (failure) {
        if (!active) return;
        setAccount(null);
        if (failure instanceof ApiError && failure.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.replace(
            `/acceso?motivo=sesion&retorno=${encodeURIComponent(next)}`
          );
        } else if (failure instanceof ApiError && failure.status === 403) {
          window.location.replace('/acceso');
        } else {
          setError(
            'No pudimos comprobar tu acceso. Revisa tu conexión e inténtalo de nuevo.'
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void check(true);

    const onFocus = () => void check(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check(false);
    };
    const unsubscribe = subscribeSessionCleared(() => {
      if (!active) return;
      setAccount(null);
      window.location.replace('/acceso?motivo=salida');
    });

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [attempt]);

  async function leave(): Promise<void> {
    if (leaving) return;
    setLeaving(true);
    setError('');
    try {
      await logout();
      setAccount(null);
      window.location.replace('/acceso?motivo=salida');
    } catch {
      setError('No pudimos confirmar el cierre de sesión. Inténtalo de nuevo.');
      setLeaving(false);
    }
  }

  const pageTitle = isRecoveryPage
    ? 'Recuperación asistida'
    : isProfilePage
      ? 'Mi cuenta'
      : isPlanesPage
        ? 'Catálogo de Planes'
        : isProfesionalesPage
          ? 'Directorio de Profesionales'
          : 'Inicio';

  const user = account
    ? { name: account.username, detail: 'Administrador' }
    : null;

  return (
    <WorkspaceLayout
      area="Administración"
      pageTitle={pageTitle}
      navigation={account ? navigation : []}
      user={user}
      onLogout={account ? leave : undefined}
      isLeaving={leaving}
    >
      {error && (
        <div
          role="alert"
          className="p-4 mb-6 rounded-xl text-xs font-semibold text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60 flex items-center justify-between"
        >
          <span>{error}</span>
          {!account && (
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="px-3 py-1 rounded-lg text-xs font-bold text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/60 hover:bg-red-200 transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {checking ? (
        <div className="space-y-6" role="status" aria-busy="true">
          <div className="h-20 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-60 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
            <div className="h-60 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : account ? (
        isRecoveryPage ? (
          <RecoveryPanel />
        ) : isPlanesPage ? (
          <PlanCatalog />
        ) : isProfesionalesPage ? (
          <ProfessionalDirectory />
        ) : !knownRoute ? (
          <section className="p-8 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Esta sección no está disponible.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              La dirección que abriste no forma parte del panel de
              administración.
            </p>
            <div>
              <Link
                to="/admin/"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                Volver a administración
              </Link>
            </div>
          </section>
        ) : isProfilePage ? (
          <>
            <section className="mb-8">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                  CUENTA ADMINISTRATIVA
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  Mi cuenta
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Identidad de gobernanza y apariencia del panel.
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <section
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0c152c] border border-indigo-100/80 dark:border-slate-800 shadow-xs"
                aria-labelledby="admin-profile-title"
              >
                <header className="flex items-center gap-4 mb-6">
                  <span
                    className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xl flex items-center justify-center shrink-0 shadow-xs"
                    aria-hidden="true"
                  >
                    {account.username.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h2
                      id="admin-profile-title"
                      className="text-lg font-bold text-slate-900 dark:text-white"
                    >
                      {account.username}
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Cuenta administrativa
                    </p>
                  </div>
                </header>

                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="shield" size={16} />
                      Rol
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      Administrador central
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="at" size={16} />
                      Usuario
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {account.username}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="mail" size={16} />
                      Correo técnico
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {account.email}
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                  Cuenta creada mediante provisión controlada de base de datos.
                </p>
              </section>

              <div className="space-y-6">
                <AppearanceSettings />
                <InstallAppCard />
              </div>
            </div>
          </>
        ) : (
          <>
            <section className="mb-8">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                  ADMINISTRACIÓN CENTRAL
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  Hola, {account.username}.
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Tu espacio para supervisar y administrar CouchOne Fit.
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <section className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-start gap-4">
                  <span
                    className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Icon name="shield" size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Acceso administrativo activo
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                      La gestión de profesionales, planes y suscripciones está disponible. Utiliza el menú lateral para acceder al Directorio de Profesionales o al Catálogo de Planes.
                    </p>
                    <div className="mt-4 flex gap-3">
                        <Link to="/admin/profesionales" className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors">Ver Profesionales</Link>
                        <Link to="/admin/planes" className="px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors">Gestionar Planes</Link>
                    </div>
                  </div>
                </div>
              </section>

              <section
                className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4"
                aria-labelledby="admin-status-title"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Icon name="sparkle" size={18} />
                  </span>
                  <div>
                    <h2
                      id="admin-status-title"
                      className="text-base font-bold text-slate-900 dark:text-white"
                    >
                      Gobernanza y seguridad
                    </h2>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Rol de la cuenta
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                      Administrador
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Estado
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                      Activo
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Aislamiento de sesiones
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                      HttpOnly + CSRF
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Permisos profesionales
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Separados (403 automático)
                    </span>
                  </li>
                </ul>
              </section>

              <InstallAppCard />

              <section
                className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4"
                aria-labelledby="admin-theme-title"
              >
                <div className="flex items-start gap-4">
                  <span
                    className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Icon name="user" size={18} />
                  </span>
                  <div>
                    <h2
                      id="admin-theme-title"
                      className="text-base font-bold text-slate-900 dark:text-white"
                    >
                      Preferencias y tema
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Configura el modo oscuro o claro para la consola
                      administrativa.
                    </p>
                  </div>
                </div>
                <div>
                  <Link
                    to="/admin/perfil"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                  >
                    Ir a mi cuenta y apariencia →
                  </Link>
                </div>
              </section>
            </div>
          </>
        )
      ) : null}
    </WorkspaceLayout>
  );
}