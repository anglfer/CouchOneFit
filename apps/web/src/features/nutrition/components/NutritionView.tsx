import type { NutritionDocument } from '../types/nutrition';

export default function NutritionView({ plan }: { plan: NutritionDocument }) {
  const hasMacros =
    plan.caloriesTarget !== null ||
    plan.proteinTargetG !== null ||
    plan.carbsTargetG !== null ||
    plan.fatTargetG !== null;

  return (
    <div className="space-y-4">
      {hasMacros && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          {plan.caloriesTarget !== null && (
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Calorías objetivo
              </span>
              <strong className="text-base font-bold text-slate-900">
                {plan.caloriesTarget} kcal
              </strong>
            </div>
          )}
          {plan.proteinTargetG !== null && (
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Proteína
              </span>
              <strong className="text-base font-bold text-slate-900">
                {plan.proteinTargetG} g
              </strong>
            </div>
          )}
          {plan.carbsTargetG !== null && (
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Carbohidratos
              </span>
              <strong className="text-base font-bold text-slate-900">
                {plan.carbsTargetG} g
              </strong>
            </div>
          )}
          {plan.fatTargetG !== null && (
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Grasas
              </span>
              <strong className="text-base font-bold text-slate-900">
                {plan.fatTargetG} g
              </strong>
            </div>
          )}
        </div>
      )}

      {plan.meals.length === 0 ? (
        <p className="ws-empty">Este plan aún no tiene tiempos de comida registrados.</p>
      ) : (
        <div className="space-y-3">
          {plan.meals.map((meal) => (
            <article
              key={meal.id}
              className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5"
            >
              <div>
                <h3 className="text-base font-bold text-slate-900">{meal.name}</h3>
                {meal.instructions && (
                  <p className="text-sm text-slate-600 mt-0.5">{meal.instructions}</p>
                )}
              </div>

              {meal.items.length > 0 && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {meal.items.map((item) => (
                    <li
                      key={item.id}
                      className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        {item.instructions && (
                          <span className="block text-xs text-slate-500">{item.instructions}</span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 self-start sm:self-auto">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}