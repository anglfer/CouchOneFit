import type { ReactElement } from 'react';
import { useLocation } from '../hooks/useLocation';
import { Link } from '../components/Link';
import MarketingPage from '../features/marketing/pages/MarketingPage';
import RegistrationPage from '../features/auth/pages/RegistrationPage';
import AccessPage from '../features/auth/pages/AccessPage';
import ProfessionalPage from '../features/professional/pages/ProfessionalPage';
import AdminPage from '../features/admin/pages/AdminPage';

export default function AppRoutes(): ReactElement {
  const { pathname } = useLocation();

  if (pathname === '/') return <MarketingPage />;
  if (pathname === '/registro') return <RegistrationPage />;
  if (pathname === '/acceso') return <AccessPage />;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <AdminPage />;
  }
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return <ProfessionalPage />;
  }

  return (
    <main className="min-h-screen bg-[#f8f9fd] text-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <img
        src="/logo.png"
        alt="CouchOne Fit"
        width="140"
        height="140"
        className="rounded-3xl shadow-xl shadow-indigo-600/15 mb-6"
      />
      <span className="px-3.5 py-1 rounded-full text-xs font-bold tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 uppercase mb-3">
        404
      </span>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
        Esta página no está disponible.
      </h1>
      <p className="text-sm sm:text-base text-slate-500 max-w-md mx-auto mb-8">
        Vuelve al inicio para conocer CouchOne Fit y el estado del producto.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-600/25 transition-all"
      >
        Volver al inicio <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
