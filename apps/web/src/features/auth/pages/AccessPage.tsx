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
      <section aria-labelledby="access-title">
        <h1
          id="access-title"
          className="font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.025em] text-brand-ink"
        >
          Inicia sesión
        </h1>
        <p className="mt-2 text-base leading-relaxed text-brand-muted">
          Entra a tu espacio con tu usuario o correo.
        </p>

        {params.get('motivo') === 'sesion' && (
          <p role="status" className="ws-alert mt-6" data-tone="warn">
            Tu sesión venció o ya no está disponible. Inicia sesión para
            continuar.
          </p>
        )}
        {params.get('motivo') === 'salida' && (
          <p role="status" className="ws-alert mt-6" data-tone="ok">
            Cerraste tu sesión correctamente.
          </p>
        )}

        <form onSubmit={submit} className="mt-8">
          <fieldset disabled={busy} className="space-y-5">
            <legend className="sr-only">Acceso a tu cuenta</legend>
            <div>
              <label
                htmlFor="access-identifier"
                className="text-sm font-semibold text-brand-ink"
              >
                Usuario o correo
              </label>
              <input
                id="access-identifier"
                name="identifier"
                autoComplete="username"
                maxLength={254}
                required
                autoCapitalize="none"
                spellCheck={false}
                className="ws-auth-input mt-2"
              />
            </div>
            <div>
              <label
                htmlFor="access-password"
                className="text-sm font-semibold text-brand-ink"
              >
                Contraseña
              </label>
              <div className="relative mt-2">
                <input
                  id="access-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="ws-auth-input pr-24!"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-controls="access-password"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-md px-3 text-sm font-semibold text-brand-primary hover:bg-[#f1f0ff]"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="mt-2.5 flex justify-end">
                <Link
                  to="/recuperar"
                  className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline"
                >
                  ¿Problemas para entrar?
                </Link>
              </div>
            </div>
            {error && (
              <p role="alert" className="ws-alert" data-tone="bad">
                {error}
              </p>
            )}
            <button
              className="mk-btn w-full"
              data-variant="primary"
              type="submit"
            >
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </fieldset>
        </form>
        <p className="mt-8 border-t border-brand-border pt-6 text-[15px] text-brand-muted">
          ¿Todavía no tienes cuenta?{' '}
          <Link
            to="/registro"
            className="font-semibold text-brand-primary underline-offset-4 hover:underline"
          >
            Crear mi cuenta
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
