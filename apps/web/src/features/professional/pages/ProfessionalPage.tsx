import type { ProfessionalProfile } from '../types/profile';
import type { Account } from '../../auth/types/session';
import { useEffect, useState, type ReactElement } from 'react';
import { ApiError } from '../../../services/api';
import {
  logout,
  readSession,
  sessionRequest,
} from '../../auth/services/session';
import { useLocation } from '../../../hooks/useLocation';
import { Link } from '../../../components/Link';
import WorkspaceLayout, {
  type WorkspaceNavItem,
} from '../../../layouts/WorkspaceLayout';
import AppearanceSettings from '../../../components/AppearanceSettings';
import InstallAppCard from '../../../components/InstallAppCard';
import { Icon } from '../../../components/Icon';
import { firstName } from '../../../utils/personName';

const navigation: WorkspaceNavItem[] = [
  { href: '/app/', label: 'Inicio', icon: 'home' },
  { href: '/app/perfil', label: 'Mi perfil', icon: 'user' },
];

export default function ProfessionalPage(): ReactElement {
  const { pathname: rawPath } = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const pathname = rawPath.replace(/\/$/, '') || '/app';
  const isProfilePage = pathname === '/app/perfil';
  const isHome = pathname === '/app';
  const knownRoute = isHome || isProfilePage;

  useEffect(() => {
    let active = true;
    const check = async (showLoading = false) => {
      if (showLoading) setIsChecking(true);
      try {
        const session = await readSession();
        if (!active) return;
        if (session.account.role === 'admin') {
          setAccount(null);
          setProfile(null);
          window.location.replace('/admin/');
          return;
        }
        const result = await sessionRequest<{ profile: ProfessionalProfile }>(
          '/api/professional/profile'
        );
        if (active) {
          setAccount(session.account);
          setProfile(result.profile);
          setError('');
        }
      } catch (failure) {
        if (!active) return;
        setAccount(null);
        setProfile(null);
        if (failure instanceof ApiError && failure.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.replace(
            `/acceso?motivo=sesion&retorno=${encodeURIComponent(next)}`
          );
        } else {
          setError(
            'No pudimos comprobar tu sesión. Revisa tu conexión e inténtalo de nuevo.'
          );
        }
      } finally {
        if (active) setIsChecking(false);
      }
    };

    void check(true);

    const onFocus = () => void check(false);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check(false);
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [attempt]);

  async function leave(): Promise<void> {
    if (isLeaving) return;
    setIsLeaving(true);
    setError('');
    try {
      await logout();
      setAccount(null);
      setProfile(null);
      window.location.replace('/acceso?motivo=salida');
    } catch {
      setError(
        'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.'
      );
      setIsLeaving(false);
    }
  }

  const pageTitle = isProfilePage ? 'Mi perfil' : 'Inicio';
  const user = profile
    ? { name: profile.fullName, detail: `@${profile.username}` }
    : account
      ? { name: account.fullName, detail: `@${account.username}` }
      : null;

  return (
    <WorkspaceLayout
      area="Panel profesional"
      pageTitle={pageTitle}
      navigation={account ? navigation : []}
      user={user}
      onLogout={account ? leave : undefined}
      isLeaving={isLeaving}
    >
      {error && (
        <div
          role="alert"
          className="p-4 mb-6 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-center justify-between"
        >
          <span>{error}</span>
          {!account && (
            <button
              type="button"
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {isChecking ? (
        <div className="space-y-6" role="status" aria-busy="true">
          <div className="h-20 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-60 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
            <div className="h-60 bg-white/60 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : account && profile ? (
        !knownRoute ? (
          <section className="p-8 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Esta sección no está disponible.
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              La dirección que abriste no forma parte del panel profesional.
            </p>
            <div>
              <Link
                to="/app/"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                Volver al inicio del panel
              </Link>
            </div>
          </section>
        ) : isProfilePage ? (
          <>
            <section className="mb-8">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                  CUENTA Y PREFERENCIAS
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  Mi perfil
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Gestiona tus datos de acceso y la apariencia de tu panel.
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <section
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0c152c] border border-indigo-100/80 dark:border-slate-800 shadow-xs"
                aria-labelledby="profile-title"
              >
                <header className="flex items-center gap-4 mb-6">
                  <span
                    className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xl flex items-center justify-center shrink-0 shadow-xs"
                    aria-hidden="true"
                  >
                    {profile.fullName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h2
                      id="profile-title"
                      className="text-lg font-bold text-slate-900 dark:text-white"
                    >
                      {profile.fullName}
                    </h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      @{profile.username}
                    </p>
                  </div>
                </header>

                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="user" size={16} />
                      Nombre
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {profile.fullName}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="at" size={16} />
                      Usuario
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {profile.username}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="mail" size={16} />
                      Correo
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {profile.email}
                    </dd>
                  </div>
                  <div className="py-3 flex items-center justify-between">
                    <dt className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icon name="phone" size={16} />
                      Teléfono
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {profile.phone ? profile.phone : 'Sin registrar'}
                    </dd>
                  </div>
                </dl>

                <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                  Tus datos de acceso están protegidos con autenticación segura.
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
                  PANEL PROFESIONAL
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                  Hola, {firstName(profile.fullName)}.
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Bienvenido a tu espacio de trabajo en CouchOne Fit.
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0c152c] border border-indigo-100/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Icon name="sparkle" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Aún no tienes un plan asignado
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                    Tu cuenta profesional está activa. Para comenzar a dar de
                    alta clientes y crear planes necesitas un plan asignado.
                  </p>
                </div>
                <div>
                  <Link
                    to="/#planes"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all"
                  >
                    Conocer los planes →
                  </Link>
                </div>
              </section>

              <section
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0c152c] border border-indigo-100/80 dark:border-slate-800 shadow-xs"
                aria-labelledby="status-title"
              >
                <div className="flex items-center gap-3 mb-5">
                  <span
                    className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Icon name="shield" />
                  </span>
                  <div>
                    <h2
                      id="status-title"
                      className="text-lg font-bold text-slate-900 dark:text-white"
                    >
                      Estado de la cuenta
                    </h2>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Tipo de cuenta
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Profesional
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Estado del acceso
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Activo
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Cartera de clientes
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Requiere suscripción
                    </span>
                  </li>
                  <li className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Acceso a la app cliente
                    </span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Vinculación por código
                    </span>
                  </li>
                </ul>
              </section>

              <InstallAppCard />

              <section
                className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0c152c] border border-indigo-100/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                aria-labelledby="quick-profile-title"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Icon name="user" />
                    </span>
                    <div>
                      <h2
                        id="quick-profile-title"
                        className="text-lg font-bold text-slate-900 dark:text-white"
                      >
                        Preferencias y tema
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                    Personaliza el modo claro u oscuro del panel según tu
                    preferencia de uso.
                  </p>
                </div>
                <div>
                  <Link
                    to="/app/perfil"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    Ir a mi perfil y apariencia →
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
