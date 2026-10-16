import { useEffect, useState, type ReactElement } from 'react';
import { ApiError } from '../../../services/api';
import {
  logout,
  readSession,
  sessionRequest,
  type Account,
} from '../../auth/services/session';
import WorkspaceLayout from '../../workspace/WorkspaceLayout';

export default function AdminApp(): ReactElement {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const knownRoute = ['/admin', '/admin/'].includes(window.location.pathname);

  useEffect(() => {
    let active = true;
    async function check() {
      setChecking(true);
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
        } else
          setError(
            'No pudimos comprobar tu acceso. Revisa tu conexión e inténtalo de nuevo.'
          );
      } finally {
        if (active) setChecking(false);
      }
    }
    void check();
    const onFocus = () => {
      void check();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [attempt]);

  async function leave() {
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

  return (
    <WorkspaceLayout
      title="Administración"
      navigation={
        account ? [{ href: '/admin/', label: 'Inicio de administración' }] : []
      }
      sessionAction={
        account && (
          <button
            type="button"
            className="workspace-button workspace-button-secondary"
            onClick={leave}
            disabled={leaving}
          >
            {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        )
      }
    >
      {error && (
        <p role="alert" className="workspace-error">
          {error}{' '}
          {!account && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Reintentar
            </button>
          )}
        </p>
      )}
      {checking ? (
        <p role="status">Comprobando tu acceso…</p>
      ) : account ? (
        <>
          {knownRoute ? (
            <>
              <section className="workspace-heading">
                <span className="workspace-label">ADMINISTRACIÓN</span>
                <h1>Hola, {account.username}.</h1>
                <p>Tu espacio para administrar CouchOne Fit.</p>
              </section>
              <section className="workspace-card">
                <h2>Acceso administrativo activo</h2>
                <p>
                  La gestión de profesionales, planes y suscripciones estará
                  disponible aquí conforme se habiliten sus módulos.
                </p>
              </section>
            </>
          ) : (
            <section className="workspace-card">
              <h1>Esta sección no está disponible.</h1>
              <a href="/admin/">Volver a administración</a>
            </section>
          )}
        </>
      ) : null}
    </WorkspaceLayout>
  );
}
