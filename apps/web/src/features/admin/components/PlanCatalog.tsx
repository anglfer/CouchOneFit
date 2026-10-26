import { useEffect, useState } from 'react';
import { sessionRequest, sessionMutation } from '../../auth/services/session';
import type { PlanSaaS } from '../types/admin';
import { ApiError } from '../../../services/api';

export default function PlanCatalog() {
  const [plans, setPlans] = useState<PlanSaaS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);
  const [isActive, setIsActive] = useState(true);
  // Estados del formulario
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState<string>(''); // Vacio o número
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
      !window.confirm(
        'El cambio afecta inmediatamente a todas las suscripciones de este plan. El exceso bloqueará nuevas altas y reactivaciones; los expedientes se conservan. ¿Guardar cambios?'
      )
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
  }

  function editPlan(plan: PlanSaaS) {
    setIsEditing(plan.id);
    setIsActive(plan.isActive);
    setName(plan.name);
    setIsUnlimited(plan.maxClients === null);
    setLimit(plan.maxClients !== null ? plan.maxClients.toString() : '');
    setPrice(plan.priceMxn.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-6">
      <section className="p-6 bg-white dark:bg-[#0c152c] rounded-2xl border border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Editar Plan' : 'Crear Nuevo Plan'}
        </h2>
        {error && (
          <p
            role="alert"
            className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl"
          >
            {error}
          </p>
        )}

        <form
          aria-busy={busy}
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <label className="block">
            <span className="text-sm font-medium">
              Nombre del Plan (Ej. Pro 30)
            </span>
            <input
              required
              minLength={3}
              maxLength={50}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Precio (MXN)</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg"
            />
          </label>

          <div className="col-span-1 md:col-span-2 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isUnlimited}
                onChange={(e) => setIsUnlimited(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-bold">Plan con cupo ilimitado</span>
            </label>
            {!isUnlimited && (
              <label className="block">
                <span className="text-sm font-medium">
                  Límite de clientes activos
                </span>
                <input
                  required={!isUnlimited}
                  type="number"
                  min="1"
                  step="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-lg"
                />
              </label>
            )}
          </div>

          <div className="col-span-1 md:col-span-2 flex gap-3 mt-2">
            <label className="block">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />{' '}
              Disponible para nuevas asignaciones
            </label>
            <button
              disabled={busy}
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
            >
              {isEditing ? 'Guardar Cambios' : 'Crear Plan'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-300"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white dark:bg-[#0c152c] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <p className="p-6">Cargando catálogo...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4 font-semibold">Plan</th>
                <th className="p-4 font-semibold">Límite</th>
                <th className="p-4 font-semibold">Precio (MXN)</th>
                <th className="p-4 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <td className="p-4 font-medium">
                    {plan.name}
                    {!plan.isActive && ' (No disponible)'}
                  </td>
                  <td className="p-4">
                    {plan.maxClients === null ? 'Ilimitado' : plan.maxClients}
                  </td>
                  <td className="p-4">${plan.priceMxn}</td>
                  <td className="p-4">
                    <button
                      onClick={() => editPlan(plan)}
                      className="text-indigo-600 font-semibold hover:underline"
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
