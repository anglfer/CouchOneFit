import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { Link } from '../../../components/Link';
import AuthShell from '../components/AuthShell';
import { authorizedReturn, login, readSession } from '../services/session';
import { ApiError } from '../../../services/api';

export default function AccessPage(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('retorno');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        String(data.get('identifier') ?? ''),
        String(data.get('password') ?? '')
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
    <AuthShell>
      <section>
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-(--ws-text)">
            Qué bueno verte de nuevo.
          </h1>
          <p className="text-base text-(--ws-muted)">
            Entra con tu usuario o correo para acceder a tu espacio.
          </p>
        </div>

        {params.get('motivo') === 'sesion' && (
          <p role="status" className="ws-alert mb-4" data-tone="warn">
            Tu sesión venció o ya no está disponible. Inicia sesión para
            continuar.
          </p>
        )}
        {params.get('motivo') === 'salida' && (
          <p role="status" className="ws-alert mb-4" data-tone="ok">
            Cerraste tu sesión correctamente.
          </p>
        )}

        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">Acceso a tu cuenta</legend>
            <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
              <span>Usuario o correo</span>
              <input
                name="identifier"
                autoComplete="username"
                maxLength={254}
                required
                autoCapitalize="none"
                spellCheck={false}
                className="ws-auth-input"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
              <span>Contraseña</span>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="ws-auth-input pr-20!"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="ws-plain absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold text-(--ws-primary-fg) hover:bg-(--ws-selected)"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
            <div className="flex justify-end">
              <Link
                to="/recuperar"
                className="text-sm font-semibold text-(--ws-primary-fg) hover:underline"
              >
                ¿Olvidaste tu contraseña o perdiste tu dispositivo?
              </Link>
            </div>
            {error && (
              <p role="alert" className="ws-alert" data-tone="bad">
                {error}
              </p>
            )}
            <button
              className="ws-btn min-h-12 w-full text-base"
              data-variant="primary"
              type="submit"
            >
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </fieldset>
          <p className="mt-6 text-center text-sm text-(--ws-muted)">
            ¿Todavía no tienes cuenta?{' '}
            <Link
              to="/registro"
              className="font-semibold text-(--ws-primary-fg) hover:underline"
            >
              Crear mi cuenta
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-(--ws-muted)">
            <Link
              to="/privacidad"
              className="font-medium text-(--ws-muted) hover:text-(--ws-primary-fg) hover:underline"
            >
              Privacidad y condiciones de uso
            </Link>
          </p>
        </form>
      </section>
    </AuthShell>
  );
}
