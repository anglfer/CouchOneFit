import { useState } from 'react';
import { sessionMutation, sessionRequest } from '../../auth/services/session';
import { ApiError } from '../../../services/api';
import type { CheckoutPlan, SubscriptionInfo } from '../types/subscription';

// DEC-017: renewal, grace, cancel at period end and downgrade choosing clients to inactivate.
const methods = [
  { id: 'test_approved', label: 'Visa 4242 (aprobará el cobro)' },
  { id: 'test_declined', label: 'Visa 0002 (rechazará el cobro)' },
  { id: 'test_error', label: 'Mastercard 9995 (error del procesador)' },
];
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('es-MX') : '';
interface ActiveClient {
  id: string;
  fullName: string;
}
const message = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No pudimos completar la acción.';

export default function SubscriptionLifecycle({
  subscription,
  plans,
  onChange,
}: {
  subscription: SubscriptionInfo;
  plans: CheckoutPlan[];
  onChange: (value: SubscriptionInfo) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [target, setTarget] = useState(''),
    [clients, setClients] = useState<ActiveClient[]>([]),
    [chosen, setChosen] = useState<string[]>([]);
  const valid =
    subscription.status === 'active' || subscription.status === 'grace';
  if (!valid || !subscription.planId) return null;
  const lower = plans.filter(
    (plan) =>
      !plan.isUnlimited &&
      plan.maxClients !== null &&
      (subscription.isUnlimited ||
        plan.maxClients < (subscription.limit ?? 0)) &&
      plan.id !== subscription.planId
  );
  const plan = lower.find((item) => item.id === target);
  const needed = plan
    ? Math.max(0, subscription.used - (plan.maxClients ?? 0))
    : 0;

  async function run(action: () => Promise<SubscriptionInfo>, done: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      onChange(await action());
      setNotice(done);
      return true;
    } catch (failure) {
      setError(message(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: object, done: string) =>
    run(
      async () =>
        (
          await sessionMutation<{ subscription: SubscriptionInfo }>(
            '/api/me/subscription',
            body,
            'PATCH'
          )
        ).subscription,
      done
    );

  async function choose(id: string) {
    setTarget(id);
    setChosen([]);
    setError('');
    const next = lower.find((item) => item.id === id);
    if (next && subscription.used > (next.maxClients ?? 0)) {
      try {
        const result = await sessionRequest<{ clients: ActiveClient[] }>(
          '/api/clients?status=active&pageSize=100'
        );
        setClients(result.clients);
      } catch (failure) {
        setError(message(failure));
      }
    }
  }
  async function downgrade() {
    const ok = await run(
      async () =>
        (
          await sessionMutation<{ subscription: SubscriptionInfo }>(
            '/api/me/subscription/downgrade',
            { planId: target, inactivateClientIds: chosen }
          )
        ).subscription,
      'Tu plan cambió. El periodo pagado sigue igual y no hay devolución.'
    );
    if (ok) {
      setTarget('');
      setChosen([]);
    }
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4">
      <h2 className="font-bold">Renovación y cambios de plan</h2>
      {subscription.status === 'grace' && (
        <p role="alert" className="rounded-xl border border-amber-400 p-3">
          No pudimos cobrar tu renovación. Conservas acceso completo hasta el{' '}
          {date(subscription.graceUntil)}; después tu plan vencerá y tus
          clientes solo podrán consultar su perfil. Cambia el método de pago y
          reintentaremos automáticamente.
        </p>
      )}
      {subscription.cancelAtPeriodEnd ? (
        <p>
          Cancelaste la renovación: tu plan rige hasta el{' '}
          {date(subscription.expiresAt)} y no se volverá a cobrar.
        </p>
      ) : (
        <p>
          Se renueva automáticamente cada mes
          {subscription.expiresAt
            ? ` (próximo cobro ${date(subscription.expiresAt)})`
            : ''}
          .
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label>
          Método de renovación{' '}
          <select
            className="border rounded p-1"
            value={subscription.renewalMethod ?? 'test_approved'}
            disabled={busy}
            onChange={(event) =>
              void patch(
                { renewalMethod: event.target.value },
                'Método de renovación actualizado.'
              )
            }
          >
            {methods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="underline"
          disabled={busy}
          onClick={() =>
            void patch(
              { cancelAtPeriodEnd: !subscription.cancelAtPeriodEnd },
              subscription.cancelAtPeriodEnd
                ? 'La renovación automática sigue activa.'
                : 'Renovación cancelada: tu plan sigue vigente hasta el final del periodo.'
            )
          }
        >
          {subscription.cancelAtPeriodEnd
            ? 'Mantener mi plan'
            : 'Cancelar al final del periodo'}
        </button>
      </div>
      {lower.length > 0 && (
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="font-semibold">Bajar de plan</legend>
          <select
            aria-label="Plan al que bajar"
            className="border rounded p-1"
            value={target}
            onChange={(event) => void choose(event.target.value)}
          >
            <option value="">Elige un plan menor…</option>
            {lower.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.maxClients} clientes
              </option>
            ))}
          </select>
          {plan && needed > 0 && (
            <div>
              <p>
                Tienes {subscription.used} clientes activos y {plan.name} admite{' '}
                {plan.maxClients}. Elige al menos {needed} para inactivar (se
                conservan sus datos y puedes reactivarlos si hay cupo).
              </p>
              <ul className="max-h-48 overflow-auto">
                {clients.map((client) => (
                  <li key={client.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chosen.includes(client.id)}
                        onChange={(event) =>
                          setChosen((current) =>
                            event.target.checked
                              ? [...current, client.id]
                              : current.filter((id) => id !== client.id)
                          )
                        }
                      />{' '}
                      {client.fullName}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan && (
            <button
              className="underline"
              disabled={busy || chosen.length < needed}
              onClick={() => void downgrade()}
            >
              Confirmar cambio a {plan.name}
            </button>
          )}
          <p className="text-sm text-slate-500">
            El cambio es inmediato, el periodo ya pagado no se devuelve y el
            precio menor aplica desde la siguiente renovación.
          </p>
        </fieldset>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
