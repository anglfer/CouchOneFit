import ClientRecordView from '../components/ClientRecordView';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import AccountProfile from '../../../components/AccountProfile';
import { Link } from '../../../components/Link';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { PageHeader } from '../../../components/ui';
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
import type { ProfessionalProfile } from '../types/profile';
import SubscriptionPanel from '../components/SubscriptionPanel';
import type { SubscriptionInfo } from '../types/subscription';
import ClientAccessPanel from '../components/ClientAccessPanel';
import RecoveryPanel from '../../auth/components/RecoveryPanel';
import ProfessionalHome from '../components/ProfessionalHome';
import PendingOperations from '../components/PendingOperations';
import { confirmLeaveWithPending } from '../../../services/offline/leave';
import TrainingPage from '../../training/pages/TrainingPage';

const navigation: WorkspaceNavItem[] = [
  { href: '/app/', label: 'Inicio', icon: 'home' },
  { href: '/app/clientes', label: 'Clientes', icon: 'users' },
  { href: '/app/entrenamiento', label: 'Rutinas', icon: 'layers' },
];

const accountMenu: WorkspaceNavItem[] = [
  { href: '/app/perfil', label: 'Mi perfil', icon: 'user' },
  { href: '/app/suscripcion', label: 'Mi suscripción', icon: 'card' },
  { href: '/app/pendientes', label: 'Pendientes de enviar', icon: 'refresh' },
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
  const isPendingPage = pathname === '/app/pendientes';
  const trainingClientId = pathname.match(
    /^\/app\/clientes\/([^/]+)\/entrenamiento$/
  )?.[1];
  const isTrainingPage =
    pathname === '/app/entrenamiento' ||
    pathname === '/app/entrenamiento/plantillas' ||
    !!trainingClientId;
  const knownRoute =
    isTrainingPage ||
    isHome ||
    isPendingPage ||
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
      if (!(await confirmLeaveWithPending())) {
        setIsLeaving(false);
        return;
      }
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

  const pageTitle = trainingClientId
    ? 'Clientes'
    : isTrainingPage
      ? 'Rutinas'
      : isPendingPage
        ? 'Pendientes de enviar'
        : isSubscriptionPage
          ? 'Mi suscripción'
          : isClientsPage
            ? 'Clientes'
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
      accountMenu={account ? accountMenu : []}
      pendingHref={account ? '/app/pendientes' : undefined}
      user={user}
      onLogout={account ? leave : undefined}
      isLeaving={isLeaving}
    >
      {error && (
        <div
          role="alert"
          className="ws-alert mb-6 flex items-center justify-between gap-3"
          data-tone="bad"
        >
          <span>{error}</span>
          {(!account || sessionUncertain) && (
            <button
              type="button"
              className="ws-btn"
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
          <LoadingScreen label="Cargando tu espacio…" />
        ) : account && profile ? (
          isPendingPage ? (
            <PendingOperations />
          ) : isSubscriptionPage && subscription ? (
            <SubscriptionPanel
              subscription={subscription}
              onSubscriptionChange={setSubscription}
            />
          ) : (isClientsPage || isRecoveryPage || isTrainingPage) &&
            subscription?.status !== 'active' ? (
            <section className="ws-card ws-empty" role="status">
              <h2 className="ws-card-title text-lg!">
                Activa un plan para continuar
              </h2>
              <p>
                Se requiere una suscripción vigente. Consulta tu plan en el
                inicio y contrata o renueva desde Mi suscripción.
              </p>
              <Link
                to="/app/suscripcion"
                className="ws-btn"
                data-variant="primary"
              >
                Ir a Mi suscripción
              </Link>
            </section>
          ) : isTrainingPage ? (
            <TrainingPage
              key={`${account.id}:${trainingClientId ?? 'hub'}`}
              clientId={trainingClientId}
            />
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
              <>
                <PageHeader
                  eyebrow="Cartera"
                  title="Clientes"
                  lead="Abre la ficha de cada cliente para ver su expediente, su rutina y su actividad."
                  actions={
                    <Link to="/app/recuperacion" className="ws-btn">
                      Recuperación asistida
                    </Link>
                  }
                />
                <ClientAccessPanel
                  sessionReady={!sessionUncertain && !isLeaving}
                  accountId={account!.id}
                  onStatusChanged={() => void refreshClientUsage()}
                />
              </>
            )
          ) : isRecoveryPage ? (
            <>
              <PageHeader
                eyebrow="Cartera"
                title="Recuperación asistida"
                lead="Ayuda a una persona a recuperar su acceso tras comprobar su identidad."
                actions={
                  <Link to="/app/clientes" className="ws-btn">
                    ← Volver a clientes
                  </Link>
                }
              />
              <RecoveryPanel />
            </>
          ) : !knownRoute ? (
            <section className="ws-card ws-empty">
              <h2 className="ws-card-title text-lg!">
                Esta sección no está disponible.
              </h2>
              <p>
                La dirección que abriste no forma parte del panel profesional.
              </p>
              <Link to="/app/" className="ws-btn" data-variant="primary">
                Volver al inicio del panel
              </Link>
            </section>
          ) : isProfilePage ? (
            <AccountProfile
              eyebrow="Cuenta y preferencias"
              title="Mi perfil"
              lead="Gestiona tus datos de acceso y la apariencia de tu panel."
              name={profile.fullName}
              caption={`@${profile.username}`}
              rows={[
                { icon: 'user', label: 'Nombre', value: profile.fullName },
                { icon: 'at', label: 'Usuario', value: profile.username },
                { icon: 'mail', label: 'Correo', value: profile.email },
                {
                  icon: 'phone',
                  label: 'Teléfono',
                  value: profile.phone ? profile.phone : 'Sin registrar',
                },
              ]}
              footnote="Tus datos de acceso están protegidos con autenticación segura."
            />
          ) : (
            <ProfessionalHome
              fullName={profile.fullName}
              subscription={subscription}
            />
          )
        ) : null}
      </div>
    </WorkspaceLayout>
  );
}
