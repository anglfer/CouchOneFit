import type { ReactElement } from 'react';
import MarketingPage from '../features/marketing/pages/MarketingPage';

export default function AppRoutes(): ReactElement {
  if (window.location.pathname === '/') return <MarketingPage />;

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
