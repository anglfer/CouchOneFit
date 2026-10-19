import { useState, type FormEvent } from 'react';
import { Brand } from '../../../components/Brand';
import { Link } from '../../../components/Link';
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
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 gap-6">
      <Brand />
      <section className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-8 space-y-5">
        <h1 className="text-2xl font-bold">Recupera tu acceso</h1>
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
          <p role="status">
            Contraseña actualizada. Todas tus sesiones anteriores se cerraron.
            Inicia sesión con tu nueva contraseña.
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="sr-only">Establecer contraseña</legend>
              <label className="block">
                Código de recuperación
                <input
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]{43}"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="block w-full border rounded-lg p-3"
                />
              </label>
              <label className="block">
                Nueva contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full border rounded-lg p-3"
                  aria-describedby="password-rule"
                />
              </label>
              <p id="password-rule">
                De 15 a 128 caracteres. Los espacios cuentan.
              </p>
              <label className="block">
                Confirmar contraseña
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full border rounded-lg p-3"
                />
              </label>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white p-3 rounded-xl disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <Link to="/acceso" className="block text-indigo-600">
          Volver al acceso
        </Link>
      </section>
    </main>
  );
}
