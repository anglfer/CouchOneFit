import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { sessionRequest, sessionMutation } from '../../auth/services/session';
import type { PlanSaaS } from '../types/admin';
import { ApiError } from '../../../services/api';
import { Badge, PageHeader } from '../../../components/ui';
import { confirmDialog } from '../../../services/confirm';
import RequiresConnection from '../../../components/RequiresConnection';
import { usePwa } from '../../../hooks/usePwa';

export default function PlanCatalog() {
  const [plans, setPlans] = useState<PlanSaaS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);
  const { isOnline } = usePwa();
  const [formOpen, setFormOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState<string>('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [price, setPrice] = useState('');

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadPlans();
    };
    void loadPlans();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  async function loadPlans() {
    try {
      const data = await sessionRequest<{ plans: PlanSaaS[] }>(
        '/api/admin/plans'
      );
      setPlans(data.plans);
      setError('');
    } catch {
      setError('Error al cargar el catálogo de planes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');

    // Validación: Límite no puede ser negativo ni 0. Debe ser nulo si es ilimitado.
    const finalLimit = isUnlimited ? null : Number(limit);
    if (
      !isUnlimited &&
      (!Number.isInteger(finalLimit) || (finalLimit as number) <= 0)
    ) {
      setError(
        'El límite debe ser un número entero mayor a 0 o marcarse como ilimitado.'
      );
      return;
    }

    const payload = {
      name,
      maxClients: finalLimit,
      isUnlimited,
      priceMxn: Number(price),
      isActive,
    };

    if (
      isEditing &&
      !(await confirmDialog({
        title: '¿Guardar cambios del plan?',
        message:
          'El cambio afecta inmediatamente a todas las suscripciones de este plan. El exceso bloqueará nuevas altas y reactivaciones; los expedientes se conservan.',
        confirmLabel: 'Guardar cambios',
      }))
    )
      return;
    setBusy(true);
    try {
      if (isEditing) {
        await sessionMutation(`/api/admin/plans/${isEditing}`, payload, 'PUT');
      } else {
        await sessionMutation('/api/admin/plans', payload, 'POST');
      }
      resetForm();
      await loadPlans();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Error al guardar el plan.');
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setIsEditing(null);
    setName('');
    setLimit('');
    setPrice('');
    setIsUnlimited(false);
    setIsActive(true);
    setFormOpen(false);
  }

  function editPlan(plan: PlanSaaS) {
    setIsEditing(plan.id);
    setIsActive(plan.isActive);
    setName(plan.name);
    setIsUnlimited(plan.maxClients === null);
    setLimit(plan.maxClients !== null ? plan.maxClients.toString() : '');
    setPrice(plan.priceMxn.toString());
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-6">
      <RequiresConnection what="los cambios al catálogo afectan a todas las suscripciones" />
      <PageHeader
        title="Planes"
        lead="Precios y límites de clientes de cada plan SaaS."
        actions={
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            onClick={() => {
              if (formOpen && !isEditing) {
                resetForm();
              } else {
                setIsEditing(null);
                setName('');
                setLimit('');
                setPrice('');
                setIsUnlimited(false);
                setIsActive(true);
                setFormOpen(true);
              }
            }}
          >
            <Icon name={formOpen && !isEditing ? 'close' : 'plus'} size={16} />
            {formOpen && !isEditing ? 'Ocultar formulario' : 'Nuevo plan'}
          </button>
        }
      />

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {(formOpen || isEditing) && (
        <section className="ws-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="ws-card-title text-lg!">
              {isEditing ? 'Editar plan' : 'Crear nuevo plan'}
            </h2>
          </div>

          <form
            aria-busy={busy}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <label className="block">
              Nombre del plan (Ej. Pro 30)
              <input
                required
                minLength={3}
                maxLength={50}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ws-input mt-1 w-full min-h-11"
              />
            </label>
            <label className="block">
              Precio (MXN)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="ws-input mt-1 w-full min-h-11"
              />
            </label>

            <div className="col-span-1 space-y-3 rounded-lg border border-(--ws-border-subtle) bg-(--ws-surface-2) p-4 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isUnlimited}
                  onChange={(e) => setIsUnlimited(e.target.checked)}
                />
                <span className="text-sm font-semibold">
                  Plan con cupo ilimitado
                </span>
              </label>
              {!isUnlimited && (
                <label className="block">
                  Límite de clientes activos
                  <input
                    required={!isUnlimited}
                    type="number"
                    min="1"
                    step="1"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="ws-input mt-1 w-full min-h-11"
                  />
                </label>
              )}
            </div>

            <div className="col-span-1 mt-2 flex flex-wrap items-center gap-3 md:col-span-2">
              <label className="mr-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Disponible para nuevas asignaciones
              </label>
              <button
                type="button"
                onClick={resetForm}
                className="ws-btn"
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                disabled={busy || !isOnline}
                type="submit"
                className="ws-btn"
                data-variant="primary"
              >
                {isEditing ? 'Guardar cambios' : 'Crear plan'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="ws-card overflow-x-auto p-0!">
        {loading ? (
          <div className="space-y-3 p-5" role="status" aria-busy="true">
            <span className="sr-only">Cargando catálogo…</span>
            <div className="ws-skeleton h-10" />
            <div className="ws-skeleton h-10" />
          </div>
        ) : plans.length === 0 ? (
          <p className="ws-empty">Todavía no hay planes configurados.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-4">Plan</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Límite</th>
                <th className="p-4">Precio (MXN)</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="p-4 font-semibold">{plan.name}</td>
                  <td className="p-4">
                    <Badge tone={plan.isActive ? 'ok' : 'neutral'}>
                      {plan.isActive ? 'Disponible' : 'No disponible'}
                    </Badge>
                  </td>
                  <td className="p-4 tabular-nums">
                    {plan.maxClients === null ? 'Ilimitado' : plan.maxClients}
                  </td>
                  <td className="p-4 tabular-nums">${plan.priceMxn} MXN</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => editPlan(plan)}
                      className="ws-btn"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
