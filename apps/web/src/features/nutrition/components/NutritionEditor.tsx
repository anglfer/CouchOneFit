import { Icon } from '../../../components/Icon';
import { emptyItem, emptyMeal } from '../services/nutrition';
import type { NutritionDocument, NutritionItem, NutritionMeal } from '../types/nutrition';

interface Props {
  value: NutritionDocument;
  onChange: (next: NutritionDocument) => void;
  disabled?: boolean;
}

const parseOptionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default function NutritionEditor({ value, onChange, disabled }: Props) {
  const updateMeal = (mealId: string, updater: (meal: NutritionMeal) => NutritionMeal) => {
    onChange({
      ...value,
      meals: value.meals.map((m) => (m.id === mealId ? updater(m) : m)),
    });
  };

  const removeMeal = (mealId: string) => {
    onChange({
      ...value,
      meals: value.meals.filter((m) => m.id !== mealId),
    });
  };

  const addMeal = () => {
    if (value.meals.length >= 12) return;
    onChange({
      ...value,
      meals: [...value.meals, emptyMeal(`Comida ${value.meals.length + 1}`)],
    });
  };

  const updateItem = (
    mealId: string,
    itemId: string,
    updater: (item: NutritionItem) => NutritionItem,
  ) => {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((i) => (i.id === itemId ? updater(i) : i)),
    }));
  };

  return (
    <div className="space-y-5">
      <section className="ws-card space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Nombre del plan alimenticio
          </label>
          <input
            type="text"
            required
            maxLength={150}
            disabled={disabled}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Ej. Plan recomposición corporal — Fase 1"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            Calorías (kcal, opcional)
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              disabled={disabled}
              value={value.caloriesTarget ?? ''}
              onChange={(e) =>
                onChange({ ...value, caloriesTarget: parseOptionalNumber(e.target.value) })
              }
              placeholder="Ej. 2200"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Proteína (g, opcional)
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              disabled={disabled}
              value={value.proteinTargetG ?? ''}
              onChange={(e) =>
                onChange({ ...value, proteinTargetG: parseOptionalNumber(e.target.value) })
              }
              placeholder="Ej. 160"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Carbohidratos (g, opcional)
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              disabled={disabled}
              value={value.carbsTargetG ?? ''}
              onChange={(e) =>
                onChange({ ...value, carbsTargetG: parseOptionalNumber(e.target.value) })
              }
              placeholder="Ej. 240"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Grasas (g, opcional)
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              disabled={disabled}
              value={value.fatTargetG ?? ''}
              onChange={(e) =>
                onChange({ ...value, fatTargetG: parseOptionalNumber(e.target.value) })
              }
              placeholder="Ej. 65"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
      </section>

      <div className="space-y-4">
        {value.meals.map((meal, mealIndex) => (
          <section key={meal.id} className="ws-card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700">
                  #{mealIndex + 1}
                </span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  disabled={disabled}
                  value={meal.name}
                  onChange={(e) =>
                    updateMeal(meal.id, (m) => ({ ...m, name: e.target.value }))
                  }
                  placeholder="Ej. Desayuno, Colación, Comida..."
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900"
                />
              </div>
              <button
                type="button"
                className="ws-btn"
                disabled={disabled || value.meals.length <= 1}
                onClick={() => removeMeal(meal.id)}
              >
                Quitar comida
              </button>
            </div>

            <input
              type="text"
              maxLength={2000}
              disabled={disabled}
              value={meal.instructions ?? ''}
              onChange={(e) =>
                updateMeal(meal.id, (m) => ({
                  ...m,
                  instructions: e.target.value.trim() ? e.target.value : null,
                }))
              }
              placeholder="Indicaciones generales de esta comida (ej. horario o preparación, opcional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
            />

            <div className="space-y-2 pt-1">
              {meal.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/50"
                >
                  <input
                    type="text"
                    required
                    maxLength={150}
                    disabled={disabled}
                    value={item.name}
                    onChange={(e) =>
                      updateItem(meal.id, item.id, (i) => ({ ...i, name: e.target.value }))
                    }
                    placeholder="Alimento (ej. Pechuga de pollo)"
                    className="sm:col-span-5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    max={10000}
                    step={0.1}
                    disabled={disabled}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(meal.id, item.id, (i) => ({
                        ...i,
                        quantity: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="Cantidad"
                    className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    maxLength={50}
                    disabled={disabled}
                    value={item.unit}
                    onChange={(e) =>
                      updateItem(meal.id, item.id, (i) => ({ ...i, unit: e.target.value }))
                    }
                    placeholder="Unidad (g, ml, pza)"
                    className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
                  />
                  <input
                    type="text"
                    maxLength={1000}
                    disabled={disabled}
                    value={item.instructions ?? ''}
                    onChange={(e) =>
                      updateItem(meal.id, item.id, (i) => ({
                        ...i,
                        instructions: e.target.value.trim() ? e.target.value : null,
                      }))
                    }
                    placeholder="Nota (opcional)"
                    className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  />
                  <button
                    type="button"
                    aria-label="Eliminar alimento"
                    disabled={disabled || meal.items.length <= 1}
                    onClick={() =>
                      updateMeal(meal.id, (m) => ({
                        ...m,
                        items: m.items.filter((x) => x.id !== item.id),
                      }))
                    }
                    className="sm:col-span-1 text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-40 py-1"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {meal.items.length < 30 && (
                <button
                  type="button"
                  className="ws-btn"
                  disabled={disabled}
                  onClick={() =>
                    updateMeal(meal.id, (m) => ({ ...m, items: [...m.items, emptyItem()] }))
                  }
                >
                  <Icon name="plus" size={14} /> Agregar alimento
                </button>
              )}
            </div>
          </section>
        ))}

        {value.meals.length < 12 && (
          <button
            type="button"
            className="ws-btn"
            disabled={disabled}
            onClick={addMeal}
          >
            <Icon name="plus" size={16} /> Agregar tiempo de comida
          </button>
        )}
      </div>
    </div>
  );
}