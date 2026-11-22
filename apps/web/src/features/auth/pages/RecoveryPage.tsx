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
      <section className="space-y-5 text-brand-muted">
        <h1 className="font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.025em] text-brand-ink">
          Recupera tu acceso
        </h1>
        <p className="text-sm leading-relaxed">
          Si perdiste tu sesión o dispositivo, primero intenta entrar con tus
          credenciales habituales. Conservarás la misma cuenta y expediente.
        </p>
        <p className="text-sm leading-relaxed">
          Si olvidaste tu contraseña, contacta a tu profesional; si eres
          profesional, contacta a la administración. Tras corroborar tu
          identidad por la relación conocida te entregarán un código válido por
          30 minutos. No basta con indicar un correo o usuario.
        </p>
        {complete ? (
          <p role="status" className="ws-alert" data-tone="ok">
            Contraseña actualizada. Todas tus sesiones anteriores se cerraron.
            Inicia sesión con tu nueva contraseña.
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="space-y-4">
              <legend className="sr-only">Establecer contraseña</legend>
              <label className="block space-y-2 text-sm font-semibold text-brand-ink">
                Código de recuperación
                <input
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]{43}"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="ws-auth-input"
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold text-brand-ink">
                Nueva contraseña
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="ws-auth-input"
                  aria-describedby="password-rule"
                />
                <span
                  id="password-rule"
                  className="block text-sm font-normal text-[#5b6388]"
                >
                  De 15 a 128 caracteres. Los espacios cuentan.
                </span>
              </label>
              <label className="block space-y-2 text-sm font-semibold text-brand-ink">
                Confirmar contraseña
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="ws-auth-input"
                />
              </label>
              <button
                type="submit"
                className="mk-btn w-full"
                data-variant="primary"
              >
                {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <p role="alert" className="ws-alert" data-tone="bad">
            {error}
          </p>
        )}
        <Link
          to="/acceso"
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand-primary underline-offset-4 hover:underline"
        >
          Volver al acceso
        </Link>
      </section>
    </AuthShell>
  );
}
