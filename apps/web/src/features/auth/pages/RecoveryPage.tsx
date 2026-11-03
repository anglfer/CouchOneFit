import { useState, type FormEvent } from 'react';
import { Link } from '../../../components/Link';
import AuthShell from '../components/AuthShell';
import { apiClient, ApiError } from '../../../services/api';
import { clearSessionState } from '../services/session';

export default function RecoveryPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password'));
    if ([...password].length < 15 || [...password].length > 128) {
      setError('La contraseña debe tener entre 15 y 128 caracteres.');
      return;
    }
    if (password !== data.get('passwordConfirmation')) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiClient('/api/auth/recovery/reset', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(data)),
      });
      form.reset();
      await clearSessionState();
      setComplete(true);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos conectar. Inténtalo de nuevo.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell>
      <section className="space-y-5 text-slate-700">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Recupera tu acceso
        </h1>
        <p>
          Si perdiste tu sesión o dispositivo, primero intenta entrar con tus
          credenciales habituales. Conservarás la misma cuenta y expediente.
        </p>
        <p>
          Si olvidaste tu contraseña, contacta a tu profesional; si eres
          profesional, contacta a la administración. Tras corroborar tu
          identidad por la relación conocida te entregarán un código válido por
          30 minutos. No basta con indicar un correo o usuario.
        </p>
        {complete ? (
          <p
            role="status"
            className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900"
          >
            Contraseña actualizada. Todas tus sesiones anteriores se cerraron.
            Inicia sesión con tu nueva contraseña.
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="sr-only">Establecer contraseña</legend>
              <label className="block text-sm font-semibold text-slate-800 space-y-1.5">
                Código de recuperación
                <input
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]{43}"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full min-h-11 px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-[10px] hover:border-indigo-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 transition-colors"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800 space-y-1.5">
                Nueva contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full min-h-11 px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-[10px] hover:border-indigo-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 transition-colors"
                  aria-describedby="password-rule"
                />
              </label>
              <p id="password-rule" className="text-xs text-slate-500">
                De 15 a 128 caracteres. Los espacios cuentan.
              </p>
              <label className="block text-sm font-semibold text-slate-800 space-y-1.5">
                Confirmar contraseña
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full min-h-11 px-3.5 py-2.5 text-base text-slate-900 bg-white border border-slate-300 rounded-[10px] hover:border-indigo-400 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-600 transition-colors"
                />
              </label>
              <button
                type="submit"
                className="w-full min-h-12 rounded-[10px] bg-indigo-600 p-3 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}
        <Link
          to="/acceso"
          className="block text-sm font-semibold text-indigo-700 hover:underline"
        >
          Volver al acceso
        </Link>
      </section>
    </AuthShell>
  );
}
