import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { Brand } from '../../../components/Brand';
import { Link } from '../../../components/Link';
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
    <div className="min-h-screen bg-[#f8f9fd] flex flex-col justify-between py-6 px-4">
      <header className="w-[min(1200px,100%)] mx-auto flex items-center justify-between py-4">
        <Brand />
        <div>
          <Link
            to="/"
            className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Volver al inicio <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main className="w-full max-w-md mx-auto my-auto p-8 sm:p-10 bg-white border border-slate-200/80 rounded-3xl shadow-xs">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200/80">
            TU ESPACIO EN COUCHONE FIT
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 mb-2">
            Qué bueno verte de nuevo.
          </h1>
          <p className="text-sm text-slate-500">
            Entra con tu usuario o correo para acceder a tu espacio.
          </p>
        </div>

        {params.get('motivo') === 'sesion' && (
          <p
            role="status"
            className="p-3 mb-4 rounded-xl text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200"
          >
            Tu sesión venció o ya no está disponible. Inicia sesión para
            continuar.
          </p>
        )}
        {params.get('motivo') === 'salida' && (
          <p
            role="status"
            className="p-3 mb-4 rounded-xl text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200"
          >
            Cerraste tu sesión correctamente.
          </p>
        )}

        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">Acceso a tu cuenta</legend>
            <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
              <span>Usuario o correo</span>
              <input
                name="identificador"
                autoComplete="username"
                maxLength={254}
                required
                autoCapitalize="none"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
              <span>Contraseña</span>
              <input
                name="contrasena"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="p-3 rounded-xl text-xs font-medium text-red-700 bg-red-50 border border-red-200"
              >
                {error}
              </p>
            )}
            <button
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              type="submit"
            >
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión →'}
            </button>
          </fieldset>
          <p className="mt-6 text-center text-xs text-slate-500">
            ¿Todavía no tienes cuenta?{' '}
            <Link
              to="/registro"
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Crear mi cuenta
            </Link>
          </p>
        </form>
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        CouchOne Fit · Sistema interno seguro
      </footer>
    </div>
  );
}
