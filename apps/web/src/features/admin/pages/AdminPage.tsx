import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import AccountProfile from '../../../components/AccountProfile';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { PageHeader } from '../../../components/ui';
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
import SupportPanel from '../components/SupportPanel';
import AdminHome from '../components/AdminHome';

const navigation: WorkspaceNavItem[] = [
  { href: '/admin/', label: 'Inicio', icon: 'home' },
  { href: '/admin/profesionales', label: 'Profesionales', icon: 'users' },
  { href: '/admin/planes', label: 'Planes', icon: 'layers' },
];

const accountMenu: WorkspaceNavItem[] = [
  { href: '/admin/perfil', label: 'Mi cuenta', icon: 'user' },
  { href: '/admin/recuperacion', label: 'Recuperación asistida', icon: 'key' },
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

  const knownRoute =
    isHome ||
    isProfilePage ||
    isRecoveryPage ||
    isPlanesPage ||
    isProfesionalesPage;

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
      accountMenu={account ? accountMenu : []}
      user={user}
      onLogout={account ? leave : undefined}
      isLeaving={leaving}
    >
      {error && (
        <div
          role="alert"
          className="ws-alert mb-6 flex items-center justify-between gap-3"
          data-tone="bad"
        >
          <span>{error}</span>
          {!account && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {checking ? (
        <LoadingScreen label="Cargando tu espacio…" />
      ) : account ? (
        isRecoveryPage ? (
          <>
            <PageHeader
              eyebrow="Soporte"
              title="Recuperación asistida"
              lead="Ayuda a una persona a recuperar su acceso tras comprobar su identidad."
            />
            <RecoveryPanel />
          </>
        ) : isPlanesPage ? (
          <PlanCatalog />
        ) : isProfesionalesPage ? (
          <div className="space-y-6">
            <ProfessionalDirectory />
            <SupportPanel />
          </div>
        ) : !knownRoute ? (
          <section className="ws-card ws-empty">
            <h2 className="ws-card-title text-lg!">
              Esta sección no está disponible.
            </h2>
            <p>
              La dirección que abriste no forma parte del panel de
              administración.
            </p>
            <Link to="/admin/" className="ws-btn" data-variant="primary">
              Volver a administración
            </Link>
          </section>
        ) : isProfilePage ? (
          <AccountProfile
            eyebrow="Cuenta administrativa"
            title="Mi cuenta"
            lead="Identidad de gobernanza y apariencia del panel."
            name={account.username}
            caption="Cuenta administrativa"
            rows={[
              { icon: 'shield', label: 'Rol', value: 'Administrador central' },
              { icon: 'at', label: 'Usuario', value: account.username },
              { icon: 'mail', label: 'Correo técnico', value: account.email },
            ]}
            footnote="Cuenta creada mediante provisión controlada de base de datos."
          />
        ) : (
          <AdminHome username={account.username} />
        )
      ) : null}
    </WorkspaceLayout>
  );
}
