import { useEffect, useState, type ReactElement } from 'react';
import { ApiError } from '../../../services/api';
import {
  logout,
  readSession,
  sessionRequest,
  type ProfessionalAccount,
} from '../services/session';
import { Brand } from '../../marketing/components/MarketingNavigation';
import '../../marketing/marketing.css';
import '../registration.css';

interface Profile {
  accountId: string;
  fullName: string;
  username: string;
  email: string;
  phone: string | null;
}

export default function ProfessionalApp(): ReactElement {
  const [account, setAccount] = useState<ProfessionalAccount | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const knownRoute = ['/app', '/app/', '/app/perfil'].includes(
    window.location.pathname
  );

  useEffect(() => {
    let active = true;
    const check = async () => {
      setIsChecking(true);
      try {
        const session = await readSession();
        const result = await sessionRequest<{ profile: Profile }>(
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
        } else
          setError(
            'No pudimos comprobar tu sesión. Revisa tu conexión e inténtalo de nuevo.'
          );
      } finally {
        if (active) setIsChecking(false);
      }
    };
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

  return (
    <div className="marketing registration-page professional-page">
      <header className="registration-header marketing-container">
        <Brand />
        {account && (
          <button
            type="button"
            className="marketing-button button-small button-secondary"
            onClick={leave}
            disabled={isLeaving}
          >
            {isLeaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        )}
      </header>
      <main className="marketing-container professional-layout">
        {error && (
          <p role="alert" className="registration-error">
            {error}{' '}
            {!account && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                Reintentar
              </button>
            )}
          </p>
        )}
        {isChecking ? (
          <p role="status">Comprobando tu sesión…</p>
        ) : account && profile ? (
          <>
            <nav aria-label="Tu espacio" className="professional-nav">
              <a href="/app/">Inicio</a>
              <a href="/app/perfil">Mi perfil</a>
            </nav>
            {!knownRoute ? (
              <section className="registration-card">
                <h1>Esta sección no está disponible.</h1>
                <a href="/app/">Volver a mi espacio</a>
              </section>
            ) : (
              <>
                <section className="professional-heading">
                  <span className="marketing-label">TU ESPACIO</span>
                  <h1>Hola, {profile.fullName}.</h1>
                  <p>Tu cuenta y tu información, en un mismo lugar.</p>
                </section>
                <div className="professional-grid">
                  <section className="registration-card">
                    <h2>Mi perfil</h2>
                    <dl className="professional-profile">
                      <dt>Nombre</dt>
                      <dd>{profile.fullName}</dd>
                      <dt>Usuario</dt>
                      <dd>{profile.username}</dd>
                      <dt>Correo</dt>
                      <dd>{profile.email}</dd>
                      <dt>Teléfono</dt>
                      <dd>{profile.phone ?? 'Sin registrar'}</dd>
                    </dl>
                  </section>
                  <section className="registration-card">
                    <h2>Aún no tienes un plan asignado.</h2>
                    <p>
                      Tu cuenta está activa. Para comenzar a administrar una
                      cartera necesitas un plan asignado.
                    </p>
                    <a href="/#planes" className="marketing-button">
                      Conocer los planes →
                    </a>
                  </section>
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
