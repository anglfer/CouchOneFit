import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../services/api';
import { sessionMutation, sessionRequest } from '../services/session';

export default function RecoveryPanel() {
  const [accounts, setAccounts] = useState<
    { id: string; username: string; role: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void sessionRequest<{ accounts: typeof accounts }>(
      '/api/accounts/recovery-targets'
    )
      .then((result) => {
        if (active) {
          setAccounts(result.accounts);
          setError('');
        }
      })
      .catch(() => {
        if (active)
          setError('No pudimos consultar las cuentas. Inténtalo de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    setDelivery(null);
    try {
      const result = await sessionMutation<{ code: string; expiresAt: string }>(
        `/api/accounts/${String(data.get('userId'))}/recovery`,
        {
          currentPassword: data.get('currentPassword'),
          identityVerified: data.get('identityVerified') === 'on',
          verificationMethod: 'known_relationship',
        }
      );
      form.reset();
      setDelivery(result);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        window.location.replace('/acceso?motivo=sesion');
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos autorizar la recuperación.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200 dark:border-slate-800 space-y-4">
      <h2 className="text-lg font-bold">Recuperación asistida</h2>
      <p>
        Corrobora la identidad fuera de banda por tu relación conocida con la
        persona. Saber su correo o usuario no es suficiente. La persona elegirá
        su contraseña en privado.
      </p>
      {loading ? (
        <p role="status">Consultando cuentas…</p>
      ) : accounts.length === 0 ? (
        <p>No hay cuentas disponibles para que autorices su recuperación.</p>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">Autorizar recuperación</legend>
            <label className="block">
              Cuenta
              <select
                name="userId"
                required
                className="block w-full border rounded-lg p-3 bg-transparent"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Tu contraseña actual
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full border rounded-lg p-3"
              />
            </label>
            <label className="flex gap-2">
              <input name="identityVerified" type="checkbox" required />
              He corroborado la identidad fuera de banda mediante la relación
              conocida.
            </label>
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
            >
              {busy ? 'Autorizando…' : 'Generar código de recuperación'}
            </button>
          </fieldset>
        </form>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar consulta
          </button>
        </div>
      )}
      {delivery && (
        <div role="status" className="space-y-3 border rounded-xl p-4">
          <p>
            Entrega este código de forma privada. Vence el{' '}
            {new Date(delivery.expiresAt).toLocaleString('es-MX')}. Reemplaza
            cualquier código de recuperación anterior.
          </p>
          <label className="block">
            Código de recuperación
            <input
              readOnly
              value={delivery.code}
              className="w-full p-3 border rounded-lg font-mono"
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button type="button" onClick={() => setDelivery(null)}>
            Ocultar código
          </button>
        </div>
      )}
    </section>
  );
}
