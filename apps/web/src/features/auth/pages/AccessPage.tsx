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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            Qué bueno verte de nuevo.
          </h1>
          <p className="text-base text-slate-600">
            Entra con tu usuario o correo para acceder a tu espacio.
          </p>
        </div>

        {params.get('motivo') === 'sesion' && (
          <p
            role="status"
            className="p-3 mb-4 rounded-xl text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200"
          >
            Tu sesión venció o ya no está disponible. Inicia sesión para
            continuar.
          </p>
        )}
        {params.get('motivo') === 'salida' && (
          <p
            role="status"
            className="p-3 mb-4 rounded-xl text-sm font-medium text-emerald-900 bg-emerald-50 border border-emerald-200"
          >
            Cerraste tu sesión correctamente.
          </p>
        )}

        <Link
          to="/recuperar"
          className="block mb-5 text-sm font-semibold text-indigo-700 hover:underline"
        >
          ¿Olvidaste tu contraseña o perdiste tu dispositivo?
        </Link>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">Acceso a tu cuenta</legend>
            <label className="block text-sm font-semibold text-slate-800 space-y-1.5">
              <span>Usuario o correo</span>
              <input
                name="identifier"
                autoComplete="username"
                maxLength={254}
                required
                autoCapitalize="none"
                spellCheck={false}
                className="w-full min-h-11 px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-[10px] hover:border-indigo-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 transition-colors"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800 space-y-1.5">
              <span>Contraseña</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full min-h-11 px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-[10px] hover:border-indigo-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 transition-colors"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="p-3 rounded-[10px] text-sm font-medium text-red-700 bg-red-50 border border-red-200"
              >
                {error}
              </p>
            )}
            <button
              className="w-full min-h-12 py-3 px-4 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              type="submit"
            >
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión →'}
            </button>
          </fieldset>
          <p className="mt-6 text-center text-sm text-slate-600">
            ¿Todavía no tienes cuenta?{' '}
            <Link
              to="/registro"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Crear mi cuenta
            </Link>
          </p>
        </form>
      </section>
    </AuthShell>
  );
}
