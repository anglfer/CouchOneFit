import ClientRecordView from '../components/ClientRecordView';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import AppearanceSettings from '../../../components/AppearanceSettings';
import { Icon } from '../../../components/Icon';
import InstallAppCard from '../../../components/InstallAppCard';
import { Link } from '../../../components/Link';
import { useLocation } from '../../../hooks/useLocation';
import type { WorkspaceNavItem } from '../../../layouts/WorkspaceLayout';
import WorkspaceLayout from '../../../layouts/WorkspaceLayout';
import { ApiError } from '../../../services/api';
import { firstName } from '../../../utils/personName';
import {
  logout,
  readSession,
  sessionRequest,
  subscribeSessionCleared,
} from '../../auth/services/session';
import type { Account } from '../../auth/types/session';
import type { ProfessionalProfile } from '../types/profile';
import SubscriptionPanel from '../components/SubscriptionPanel';
import type { SubscriptionInfo } from '../types/subscription';
import ClientAccessPanel from '../components/ClientAccessPanel';
import RecoveryPanel from '../../auth/components/RecoveryPanel';

const navigation: WorkspaceNavItem[] = [
  { href: '/app/', label: 'Inicio', icon: 'home' },
  { href: '/app/suscripcion', label: 'Mi suscripción', icon: 'shield' },
  { href: '/app/perfil', label: 'Mi perfil', icon: 'user' },
  { href: '/app/clientes', label: 'Acceso de clientes', icon: 'user' },
  { href: '/app/recuperacion', label: 'Recuperación asistida', icon: 'shield' },
];

export default function ProfessionalPage(): ReactElement {
  const { pathname: rawPath } = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null
  );
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [sessionUncertain, setSessionUncertain] = useState(false);
  const [capacityError, setCapacityError] = useState('');
  const accountRef = useRef<Account | null>(null);
  const sessionEpoch = useRef(0);

  function discardSession(): void {
    sessionEpoch.current += 1;
    accountRef.current = null;
    setAccount(null);
    setProfile(null);
    setSubscription(null);
    setSessionUncertain(false);
    setCapacityError('');
  }

  const pathname = rawPath.replace(/\/$/, '') || '/app';
  const isProfilePage = pathname === '/app/perfil';
  const isHome = pathname === '/app';
  const selectedClientId = pathname.match(/^\/app\/clientes\/([^/]+)$/)?.[1];
  const isClientsPage = pathname === '/app/clientes' || !!selectedClientId;
  const isSubscriptionPage = pathname === '/app/suscripcion';
  const isRecoveryPage = pathname === '/app/recuperacion';
  const knownRoute =
    isHome ||
    isProfilePage ||
    isClientsPage ||
    isRecoveryPage ||
    isSubscriptionPage;

  useEffect(() => {
    let active = true;
    let checking = false;
    const check = async (showLoading = false) => {
      if (checking) return;
      checking = true;
      const epoch = sessionEpoch.current;
      const current = () => active && epoch === sessionEpoch.current;
      if (showLoading && !accountRef.current) setIsChecking(true);
      try {
        const session = await readSession();
        if (!current()) return;
        if (session.account.role === 'admin') {
          discardSession();
          window.location.replace('/admin/');
          return;
        }
        // Destroy the old subtree as soon as a different account is known,
        // even if its profile/subscription request subsequently fails.
        if (
          accountRef.current &&
          accountRef.current.id !== session.account.id
        ) {
          accountRef.current = null;
          setAccount(null);
          setProfile(null);
          setSubscription(null);
          setSessionUncertain(true);
        }

        const [profileRes, subRes] = await Promise.all([
          sessionRequest<{ profile: ProfessionalProfile }>(
            '/api/professional/profile'
          ),
          sessionRequest<{ subscription: SubscriptionInfo }>(
            '/api/me/subscription'
          ),
        ]);

        if (current()) {
          if (profileRes.profile.userId !== session.account.id) {
            throw new ApiError(401, 'SESSION_INVALID', 'La sesión cambió.');
          }
          accountRef.current = session.account;
          setAccount(session.account);
          setProfile(profileRes.profile);
          setSubscription(subRes.subscription);
          setError('');
          setSessionUncertain(false);
        }
      } catch (failure) {
        if (!current()) return;

        if (failure instanceof ApiError && failure.status === 401) {
          discardSession();
          const next = window.location.pathname + window.location.search;
          window.location.replace(
            `/acceso?motivo=sesion&retorno=${encodeURIComponent(next)}`
          );
        } else if (
          failure instanceof ApiError &&
          failure.status === 403 &&
          ['ROLE_FORBIDDEN', 'ACCESS_DENIED'].includes(failure.code)
        ) {
          discardSession();
          window.location.replace('/acceso');
        } else {
          // Keep the mounted draft only in memory. It remains hidden/inert
          // until the server validates the same account again.
          setSessionUncertain(true);
          setError(
            'No pudimos comprobar tu sesión. Revisa tu conexión e inténtalo de nuevo.'
          );
        }
      } finally {
        checking = false;
        if (active) setIsChecking(false);
      }
    };

    void check(true);

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check(false);
    }, 60000);
    const onFocus = () => void check(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check(false);
    };
    const unsubscribe = subscribeSessionCleared(() => {
      if (!active) return;
      discardSession();
      window.location.replace('/acceso?motivo=salida');
    });

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [attempt]);

  async function refreshClientUsage(): Promise<void> {
    const subject = accountRef.current?.id;
    const epoch = sessionEpoch.current;
    if (!subject) return;
    try {
      const result = await sessionRequest<{ subscription: SubscriptionInfo }>(
        '/api/me/subscription'
      );
      if (
        accountRef.current?.id === subject &&
        sessionEpoch.current === epoch
      ) {
        setSubscription(result.subscription);
        setCapacityError('');
      }
    } catch {
      if (accountRef.current?.id === subject && sessionEpoch.current === epoch)
        setCapacityError(
          'El estado se confirmó, pero no pudimos actualizar el cupo. El resumen puede estar desactualizado.'
        );
    }
  }
  async function leave(): Promise<void> {
    if (isLeaving) return;
    sessionEpoch.current += 1;
    setIsLeaving(true);
    setError('');
    try {
      await logout();
      discardSession();
      window.location.replace('/acceso?motivo=salida');
    } catch {
      setError(
        'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.'
      );
      setIsLeaving(false);
    }
  }

  const pageTitle = isSubscriptionPage
    ? 'Mi suscripción'
    : isClientsPage
      ? 'Acceso de clientes'
      : isRecoveryPage
        ? 'Recuperación asistida'
        : isProfilePage
          ? 'Mi perfil'
          : 'Inicio';
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
          {(!account || sessionUncertain) && (
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

      <div
        key={account?.id ?? 'anonymous'}
        hidden={sessionUncertain}
        inert={sessionUncertain}
      >
        {account && capacityError && (
          <div role="alert">
            <p>{capacityError}</p>
            <button type="button" onClick={() => void refreshClientUsage()}>
              Actualizar resumen de cupo
            </button>
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
          isSubscriptionPage && subscription ? (
            <SubscriptionPanel
              subscription={subscription}
              onSubscriptionChange={setSubscription}
            />
          ) : (isClientsPage || isRecoveryPage) &&
            subscription?.status !== 'active' ? (
            <p role="status">
              Se requiere una suscripción vigente. Consulta tu plan en el inicio
              y contrata o renueva desde Mi suscripción.
            </p>
          ) : isClientsPage ? (
            selectedClientId ? (
              <ClientRecordView
                sessionReady={!sessionUncertain && !isLeaving}
                onStatusChanged={() => void refreshClientUsage()}
                accountId={account!.id}
                key={selectedClientId}
                clientId={selectedClientId}
              />
            ) : (
              <ClientAccessPanel
                sessionReady={!sessionUncertain && !isLeaving}
                accountId={account!.id}
                onStatusChanged={() => void refreshClientUsage()}
              />
            )
          ) : isRecoveryPage ? (
            <RecoveryPanel />
          ) : !knownRoute ? (
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
                    Tus datos de acceso están protegidos con autenticación
                    segura.
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
                          Acceso a tu cartera
                        </h2>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                      Consulta el acceso de los expedientes preparados y entrega
                      sus invitaciones. La disponibilidad depende de tu
                      suscripción vigente.
                    </p>
                  </div>
                  <div>
                    <Link
                      to="/app/clientes"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all"
                    >
                      Acceso de clientes →
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
                        Estado de la suscripción
                      </h2>
                    </div>
                  </div>

                  {subscription ? (
                    <div>
                      {subscription.excess > 0 && (
                        <p role="status">
                          Exceso: {subscription.excess} clientes. Las nuevas
                          altas y reactivaciones están bloqueadas; tus
                          expedientes se conservan.
                        </p>
                      )}
                      {subscription.expiresAt && (
                        <p>
                          Vigencia hasta{' '}
                          {new Date(subscription.expiresAt).toLocaleString(
                            'es-MX'
                          )}
                        </p>
                      )}
                      {subscription.status !== 'active' && (
                        <p>
                          Contrata o renueva desde Mi suscripción para habilitar
                          tu cartera.
                        </p>
                      )}
                      <Link
                        to="/app/suscripcion"
                        className="inline-block my-3 text-indigo-600 font-bold"
                      >
                        Gestionar mi suscripción →
                      </Link>
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        <li className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">
                            Plan actual
                          </span>
                          <span className="font-bold text-indigo-700 dark:text-indigo-400">
                            {subscription.planName || 'Sin plan asignado'}
                          </span>
                        </li>
                        <li className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">
                            Estado
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${subscription.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200'}`}
                          >
                            {
                              {
                                active: 'Activa',
                                suspended: 'Suspendida',
                                expired: 'Vencida',
                                none: 'Sin suscripción',
                              }[subscription.status]
                            }
                          </span>
                        </li>
                        <li className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">
                            Clientes activos
                          </span>
                          <span className="font-mono text-sm">
                            {subscription.used} /{' '}
                            {subscription.isUnlimited
                              ? 'Ilimitado'
                              : subscription.limit}
                          </span>
                        </li>
                        <li className="py-2.5 flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">
                            Capacidad restante
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {subscription.remaining === null
                              ? 'Ilimitado'
                              : `${subscription.remaining} plazas libres`}
                          </span>
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 animate-pulse mt-4">
                      Cargando estado...
                    </p>
                  )}
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
      </div>
    </WorkspaceLayout>
  );
}
