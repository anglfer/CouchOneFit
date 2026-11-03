import { useEffect, useRef, useState } from 'react';
import { sessionRequest, sessionMutation } from '../../auth/services/session';
import { usePlanCatalog } from '../../../hooks/usePlanCatalog';
import { ApiError } from '../../../services/api';
import type { SimulatedPayment, SubscriptionInfo } from '../types/subscription';
import SubscriptionLifecycle from './SubscriptionLifecycle';
import { Badge, PageHeader } from '../../../components/ui';
const money = (cents: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    cents / 100
  );
const statusLabels = {
  pending: 'Por confirmar',
  processing: 'Procesando',
  succeeded: 'Aprobado',
  failed: 'No aprobado',
  cancelled: 'Cancelado',
};
const failures: Record<string, string> = {
  PAYMENT_DECLINED: 'La tarjeta rechazó la operación. Tu plan no cambió.',
  PROCESSOR_ERROR: 'No pudimos procesar el pago. Tu plan no cambió.',
  QUOTE_EXPIRED: 'La cotización venció. Solicita una nueva.',
  CHECKOUT_STALE:
    'El catálogo o tu suscripción cambió. Solicita una nueva cotización.',
};
const cards = [
  {
    id: 'test_approved',
    name: 'Visa',
    last: '4242',
    description: 'Crédito',
  },
  {
    id: 'test_declined',
    name: 'Visa',
    last: '0002',
    description: 'Débito',
  },
  {
    id: 'test_error',
    name: 'Mastercard',
    last: '9995',
    description: 'Crédito',
  },
];
export default function SubscriptionPanel({
  subscription,
  onSubscriptionChange,
}: {
  subscription: SubscriptionInfo;
  onSubscriptionChange: (value: SubscriptionInfo) => void;
}) {
  const {
    plans,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = usePlanCatalog();
  const [history, setHistory] = useState<SimulatedPayment[]>([]);
  const [payment, setPayment] = useState<SimulatedPayment | null>(null),
    [instrument, setInstrument] = useState('test_approved');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const updated = useRef<string | null>(null);
  const subscriptionCallback = useRef(onSubscriptionChange);
  useEffect(() => {
    subscriptionCallback.current = onSubscriptionChange;
  }, [onSubscriptionChange]);
  const idempotency = useRef<{ planId: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    void sessionRequest<{ payments: SimulatedPayment[] }>('/api/me/payments')
      .then(async (records) => {
        if (!active) return;

        setHistory(records.payments);
        const stored = sessionStorage.getItem('cof-payment-id');
        const resume =
          records.payments.find(
            (item) => item.status === 'processing' || item.status === 'pending'
          ) ?? records.payments.find((item) => item.id === stored);
        if (resume) {
          const result = await sessionRequest<{ payment: SimulatedPayment }>(
            `/api/me/payments/${resume.id}`
          );
          if (active) setPayment(result.payment);
          if (result.payment.status === 'succeeded') {
            const current = await sessionRequest<{
              subscription: SubscriptionInfo;
            }>('/api/me/subscription');
            if (active) subscriptionCallback.current(current.subscription);
          }
          if (active)
            setHistory(
              records.payments.map((item) =>
                item.id === result.payment.id ? result.payment : item
              )
            );
        }
        if (active) setError('');
      })
      .catch((failure) => {
        if (active)
          setError(
            failure instanceof ApiError
              ? failure.message
              : 'No pudimos cargar tu suscripción.'
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (payment?.status !== 'processing') return;
    let active = true,
      inFlight = false;
    const poll = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const result = await sessionRequest<{ payment: SimulatedPayment }>(
          `/api/me/payments/${payment.id}`
        );
        if (!active) return;
        if (result.payment.status !== 'processing') {
          const records = await sessionRequest<{
            payments: SimulatedPayment[];
          }>('/api/me/payments');
          if (active) setHistory(records.payments);
          if (
            result.payment.status === 'succeeded' &&
            updated.current !== result.payment.id
          ) {
            const current = await sessionRequest<{
              subscription: SubscriptionInfo;
            }>('/api/me/subscription');
            if (active) {
              updated.current = result.payment.id;
              subscriptionCallback.current(current.subscription);
            }
          }
        }
        if (active) {
          setPayment(result.payment);
          setError('');
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof ApiError
              ? failure.message
              : 'No pudimos consultar el resultado. La operación sigue guardada; puedes reanudarla.'
          );
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [payment?.id, payment?.status]);
  async function start(plan: (typeof plans)[number]) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!idempotency.current) {
        const saved = sessionStorage.getItem('cof-payment-attempt');
        if (saved) {
          try {
            idempotency.current = JSON.parse(saved);
          } catch {
            sessionStorage.removeItem('cof-payment-attempt');
          }
        }
      }
      if (idempotency.current?.planId !== plan.id)
        idempotency.current = { planId: plan.id, key: crypto.randomUUID() };
      sessionStorage.setItem(
        'cof-payment-attempt',
        JSON.stringify(idempotency.current)
      );
      const result = await sessionMutation<{ payment: SimulatedPayment }>(
        '/api/me/payments',
        { planId: plan.id, idempotencyKey: idempotency.current!.key }
      );
      setPayment(result.payment);
      sessionStorage.setItem('cof-payment-id', result.payment.id);
      setHistory(
        (
          await sessionRequest<{ payments: SimulatedPayment[] }>(
            '/api/me/payments'
          )
        ).payments
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos preparar el pago. Reintenta para recuperar la misma operación.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function operate(action: 'confirm' | 'cancel') {
    if (!payment || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await sessionMutation<{ payment: SimulatedPayment }>(
        `/api/me/payments/${payment.id}/${action}`,
        action === 'confirm' ? { instrument } : {}
      );
      setPayment(result.payment);
      if (result.payment.status === 'succeeded') {
        const current = await sessionRequest<{
          subscription: SubscriptionInfo;
        }>('/api/me/subscription');
        onSubscriptionChange(current.subscription);
      }
      setHistory(
        (
          await sessionRequest<{ payments: SimulatedPayment[] }>(
            '/api/me/payments'
          )
        ).payments
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No se pudo confirmar el resultado. Consulta el historial antes de reintentar.'
      );
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  async function resume(item: SimulatedPayment) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await sessionRequest<{ payment: SimulatedPayment }>(
        `/api/me/payments/${item.id}`
      );
      setPayment(result.payment);
      sessionStorage.setItem('cof-payment-id', item.id);
      if (result.payment.status === 'succeeded') {
        const current = await sessionRequest<{
          subscription: SubscriptionInfo;
        }>('/api/me/subscription');
        onSubscriptionChange(current.subscription);
      }
      setHistory((items) =>
        items.map((entry) =>
          entry.id === result.payment.id ? result.payment : entry
        )
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos recuperar la operación.'
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    setPayment(null);
    idempotency.current = null;
    sessionStorage.removeItem('cof-payment-id');
    sessionStorage.removeItem('cof-payment-attempt');
    setError('');
  }
  const open =
    payment?.status === 'pending' || payment?.status === 'processing';
  const eligible = plans.filter(
    (plan) =>
      (subscription.status !== 'active' && subscription.status !== 'grace') ||
      (!subscription.isUnlimited &&
        (plan.isUnlimited ||
          (plan.maxClients ?? 0) > (subscription.limit ?? 0)))
  );
  const card = cards.find((item) => item.id === instrument)!;
  return (
    <section className="space-y-6" aria-label="Mi suscripción">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi suscripción"
        lead="Contrata o sube de nivel desde tu cuenta."
      />
      <div className="ws-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="ws-stat-label">Plan actual</p>
            <h2 className="ws-stat-value">
              {subscription.planName ?? 'Sin plan contratado'}
            </h2>
          </div>
          <Badge tone={subscription.status === 'active' ? 'ok' : 'warn'}>
            {subscription.status === 'active'
              ? 'Activa'
              : subscription.status === 'grace'
                ? 'En gracia'
                : 'Sin suscripción vigente'}
          </Badge>
        </div>
        <p className="mt-4 text-sm">
          {subscription.used} clientes activos ·{' '}
          {subscription.isUnlimited
            ? 'Cupo ilimitado'
            : `Límite: ${subscription.limit ?? 0}`}
        </p>
        <p className="mt-1 text-sm text-(--ws-muted)">
          {subscription.expiresAt
            ? `Vigencia hasta ${new Date(subscription.expiresAt).toLocaleString('es-MX')}`
            : 'Contrata un plan para habilitar tu cartera.'}
        </p>
        <p className="ws-alert mt-4 text-[13px]!">
          Una contratación o mejora aprobada cobra el precio completo e inicia
          un nuevo mes. No se aplica prorrateo ni saldo del periodo anterior.
        </p>
      </div>
      <SubscriptionLifecycle
        subscription={subscription}
        plans={plans}
        onChange={onSubscriptionChange}
      />
      {(error || catalogError) && (
        <div role="alert" className="ws-alert" data-tone="bad">
          <p>{error || catalogError}</p>
          <button
            className="underline mt-2"
            onClick={() => {
              setAttempt((n) => n + 1);
              reloadCatalog();
            }}
          >
            Actualizar estado e historial
          </button>
        </div>
      )}
      {loading || catalogLoading ? (
        <p role="status">Cargando planes y operaciones…</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {eligible.map((plan) => (
            <article key={plan.id} className="ws-card space-y-3">
              <h2 className="ws-card-title text-lg!">{plan.name}</h2>
              <p className="ws-stat-value">
                {money(Math.round(Number(plan.priceMxn) * 100))}{' '}
                <span className="text-sm font-normal text-(--ws-muted)">
                  MXN / mes
                </span>
              </p>
              <p className="text-sm text-(--ws-muted)">
                {plan.isUnlimited
                  ? 'Clientes ilimitados'
                  : `${plan.maxClients} clientes activos`}
              </p>
              <button
                disabled={busy || open}
                onClick={() => void start(plan)}
                className="w-full bg-indigo-600"
              >
                {busy
                  ? 'Preparando…'
                  : subscription.status === 'active'
                    ? 'Subir a este plan'
                    : 'Contratar este plan'}
              </button>
            </article>
          ))}
        </div>
      )}
      {!loading && !eligible.length && (
        <p>Ya cuentas con la mayor capacidad disponible.</p>
      )}
      {payment && (
        <section
          className="ws-card space-y-4"
          aria-labelledby="checkout-heading"
        >
          <h2 id="checkout-heading" className="ws-card-title text-lg!">
            {payment.status === 'succeeded' ? 'Pago aprobado' : 'Pago'}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 [&_dt]:text-xs [&_dt]:font-semibold [&_dt]:text-(--ws-muted)">
            <div>
              <dt>Plan</dt>
              <dd className="font-bold">{payment.planName}</dd>
            </div>
            <div>
              <dt>Total a pagar</dt>
              <dd className="text-xl font-bold">
                {money(payment.amountCents)} MXN
              </dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd className="break-all font-mono text-xs">{payment.id}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{statusLabels[payment.status]}</dd>
            </div>
          </dl>
          {payment.status === 'pending' && (
            <>
              <p>
                El nuevo periodo mensual comienza únicamente al aprobarse el
                pago. Cotización válida hasta{' '}
                {new Date(payment.quoteExpiresAt).toLocaleString('es-MX')}.
              </p>
              <fieldset className="space-y-3">
                <legend className="font-bold">Método de pago</legend>
                {cards.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-(--ws-border) bg-(--ws-surface-2) p-3 has-[:checked]:border-(--ws-primary) has-[:checked]:bg-(--ws-selected)"
                  >
                    <input
                      type="radio"
                      name="test-card"
                      value={item.id}
                      checked={instrument === item.id}
                      onChange={() => setInstrument(item.id)}
                    />
                    <span>
                      {item.name} · •••• {item.last}
                      <small className="block">{item.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="rounded-lg bg-(--ws-surface-2) p-4 text-sm">
                <p>
                  {card.name} · •••• •••• •••• {card.last}
                </p>
                <p>Titular: Tarjeta guardada · Vence: 12/30 · CVV: •••</p>
              </div>
              <button
                disabled={busy}
                onClick={() => void operate('confirm')}
                className="bg-indigo-600"
              >
                {busy
                  ? 'Confirmando…'
                  : `Confirmar pago de ${money(payment.amountCents)}`}
              </button>
            </>
          )}
          {payment.status === 'processing' && (
            <div role="status" aria-live="polite" className="ws-alert">
              <p className="font-bold animate-pulse">Procesando tu pago…</p>
              <p>
                Validando la autorización. Puedes volver a esta pantalla si
                cierras o recargas.
              </p>
            </div>
          )}
          {open && (
            <button
              disabled={busy}
              onClick={() => void operate('cancel')}
              className="ml-2"
            >
              Cancelar operación
            </button>
          )}
          {payment.status === 'succeeded' && (
            <div role="status" className="ws-alert space-y-1" data-tone="ok">
              <h3 className="font-bold">Comprobante de pago</h3>
              <p>Tu pago fue aprobado y tu plan está activo.</p>
              <p>Importe: {money(payment.amountCents)} MXN</p>
              <p>
                Fecha: {new Date(payment.completedAt!).toLocaleString('es-MX')}
              </p>
              <p>
                Nuevo periodo:{' '}
                {new Date(payment.periodStart!).toLocaleString('es-MX')} —{' '}
                {new Date(payment.periodEnd!).toLocaleString('es-MX')}
              </p>
            </div>
          )}
          {payment.status === 'failed' && (
            <p role="alert">
              {failures[payment.failureCode ?? ''] ??
                'La operación no se completó. Tu plan no cambió.'}
            </p>
          )}
          {payment.status === 'cancelled' && (
            <p role="status">
              Operación cancelada. Tu plan y vigencia permanecen sin cambios.
            </p>
          )}
          {!open && (
            <button onClick={close}>
              {payment.status === 'succeeded'
                ? 'Volver a los planes'
                : 'Iniciar un nuevo intento'}
            </button>
          )}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="ws-card-title text-lg!">Historial de pagos</h2>
        {!history.length ? (
          <p className="ws-card ws-empty">Aún no tienes operaciones.</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {history.map((item) => (
              <li
                key={item.id}
                className="ws-card flex flex-wrap items-center justify-between gap-3 p-4!"
              >
                <div>
                  <strong>{item.planName}</strong>
                  <p className="text-sm text-(--ws-muted)">
                    {money(item.amountCents)} MXN · {statusLabels[item.status]}{' '}
                    · {new Date(item.createdAt).toLocaleString('es-MX')}
                  </p>
                </div>
                <button
                  disabled={busy}
                  className="underline"
                  onClick={() => void resume(item)}
                >
                  {item.status === 'pending' || item.status === 'processing'
                    ? 'Reanudar operación'
                    : 'Ver comprobante'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
