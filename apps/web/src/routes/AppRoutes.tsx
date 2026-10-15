import type { ReactElement } from 'react';
import MarketingPage from '../features/marketing/pages/MarketingPage';
import RegistrationPage from '../features/auth/pages/RegistrationPage';
import AccessPage from '../features/auth/pages/AccessPage';
import ProfessionalApp from '../features/auth/pages/ProfessionalApp';

export default function AppRoutes(): ReactElement {
  if (window.location.pathname === '/') return <MarketingPage />;
  if (window.location.pathname === '/registro') return <RegistrationPage />;
  if (window.location.pathname === '/acceso') return <AccessPage />;
  if (
    window.location.pathname === '/app' ||
    window.location.pathname.startsWith('/app/')
  )
    return <ProfessionalApp />;

  return (
    <main className="route-not-found">
      <img src="/logo.png" alt="CouchOne Fit" width="160" height="160" />
      <p>404</p>
      <h1>Esta página no está disponible.</h1>
      <p>
        Vuelve al inicio para conocer CouchOne Fit y el estado del producto.
      </p>
      <a href="/">
        Volver al inicio <span aria-hidden="true">→</span>
      </a>
    </main>
  );
}
