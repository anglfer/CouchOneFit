import ThemeToggle from '../../../shared/ThemeToggle';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { Brand } from '../../marketing/components/MarketingNavigation';
import '../../marketing/marketing.css';
import '../registration.css';
import { authorizedReturn, login, readSession } from '../services/session';
import { ApiError } from '../../../services/api';

export default function AccessPage(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('retorno');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void readSession()
      .then(({ account }) => {
        if (active)
          window.location.replace(authorizedReturn(returnTo, account.role));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [returnTo]);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (lock.current) return;
    const data = new FormData(event.currentTarget);
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { account } = await login(
        String(data.get('identificador') ?? ''),
        String(data.get('contrasena') ?? '')
      );
      window.location.replace(authorizedReturn(returnTo, account.role));
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
      );
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="marketing registration-page">
      <header className="registration-header marketing-container">
        <Brand />
        <div className="registration-actions">
          <ThemeToggle />
          <a href="/">Volver al inicio ↗</a>
        </div>
      </header>
      <main className="registration-card access-page">
        <span className="marketing-label">TU ESPACIO EN COUCHONE FIT</span>
        <h1>Qué bueno verte de nuevo.</h1>
        <p>Entra con tu usuario o correo para acceder a tu espacio.</p>
        {params.get('motivo') === 'sesion' && (
          <p role="status">
            Tu sesión venció o ya no está disponible. Inicia sesión para
            continuar.
          </p>
        )}
        {params.get('motivo') === 'salida' && (
          <p role="status">Cerraste tu sesión correctamente.</p>
        )}
        <form className="registration-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend className="registration-sr-only">Acceso a tu cuenta</legend>
            <label>
              Usuario o correo
              <input
                name="identificador"
                autoComplete="username"
                maxLength={254}
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label>
              Contraseña
              <input
                name="contrasena"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="registration-error">
                {error}
              </p>
            )}
            <button className="marketing-button" type="submit">
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión →'}
            </button>
          </fieldset>
          <p className="registration-login">
            ¿Todavía no tienes cuenta? <a href="/registro">Crear mi cuenta</a>
          </p>
        </form>
      </main>
    </div>
  );
}
