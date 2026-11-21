import { Icon } from '../components/Icon';
import type { ReactElement } from 'react';
import { useLocation } from '../hooks/useLocation';
import { Link } from '../components/Link';
import { LogoMark } from '../components/LogoMark';
import MarketingPage from '../features/marketing/pages/MarketingPage';
import RegistrationPage from '../features/auth/pages/RegistrationPage';
import AccessPage from '../features/auth/pages/AccessPage';
import ProfessionalPage from '../features/professional/pages/ProfessionalPage';
import AdminPage from '../features/admin/pages/AdminPage';
import RecoveryPage from '../features/auth/pages/RecoveryPage';
import PrivacyPage from '../features/auth/pages/PrivacyPage';

export default function AppRoutes(): ReactElement {
  const { pathname } = useLocation();

  if (pathname === '/') return <MarketingPage />;
  if (pathname === '/registro') return <RegistrationPage />;
  if (pathname === '/acceso') return <AccessPage />;
  if (pathname === '/recuperar') return <RecoveryPage />;
  if (pathname === '/privacidad') return <PrivacyPage />;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <AdminPage />;
  }
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return <ProfessionalPage />;
  }

  return (
    <main className="ws-auth-shell items-center justify-center p-6 text-center">
      <div className="ws-auth-card max-w-md space-y-4 p-8">
        <LogoMark size={96} title="CouchOne Fit" className="mx-auto" />
        <span className="ws-badge mx-auto" data-tone="info">
          Error 404
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-(--ws-text) sm:text-3xl">
          Esta página no está disponible.
        </h1>
        <p className="text-sm text-(--ws-muted)">
          Vuelve al inicio para conocer CouchOne Fit y continuar en tu espacio.
        </p>
        <Link to="/" className="ws-btn min-h-11 w-full" data-variant="primary">
          Volver al inicio <Icon name="arrow-right" size={14} />
        </Link>
      </div>
    </main>
  );
}
