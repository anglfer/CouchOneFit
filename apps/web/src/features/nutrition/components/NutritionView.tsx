import type { NutritionDocument } from '../types/nutrition';

const formatQuantity = (qty: number) =>
  Number.isInteger(qty) ? qty.toString() : qty.toFixed(1).replace('.', ',');

export default function NutritionView({ plan }: { plan: NutritionDocument }) {
  const hasMacros =
    plan.caloriesTarget !== null ||
    plan.proteinTargetG !== null ||
    plan.carbsTargetG !== null ||
    plan.fatTargetG !== null;

  return (
    <div className="training-view">
      {hasMacros && (
        <div className="nutrition-macros-grid">
          {plan.caloriesTarget !== null && (
            <div className="nutrition-macro-tile">
              <span>Calorías objetivo</span>
              <strong>{plan.caloriesTarget} kcal</strong>
            </div>
          )}
          {plan.proteinTargetG !== null && (
            <div className="nutrition-macro-tile">
              <span>Proteína</span>
              <strong>{plan.proteinTargetG} g</strong>
            </div>
          )}
          {plan.carbsTargetG !== null && (
            <div className="nutrition-macro-tile">
              <span>Carbohidratos</span>
              <strong>{plan.carbsTargetG} g</strong>
            </div>
          )}
          {plan.fatTargetG !== null && (
            <div className="nutrition-macro-tile">
              <span>Grasas</span>
              <strong>{plan.fatTargetG} g</strong>
            </div>
          )}
        </div>
      )}

      {plan.meals.length === 0 ? (
        <p className="ws-empty">Este plan aún no tiene tiempos de comida registrados.</p>
      ) : (
        <div className="nutrition-view-meals">
          {plan.meals.map((meal, idx) => (
            <article key={meal.id} className="nutrition-view-meal">
              <div className="nutrition-view-meal-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="training-order" aria-hidden="true">
                    {idx + 1}
                  </span>
                  <h3>{meal.name}</h3>
                </div>
                <small className="training-muted">
                  {meal.items.length} {meal.items.length === 1 ? 'alimento' : 'alimentos'}
                </small>
              </div>

              {meal.instructions && <p className="training-muted">{meal.instructions}</p>}

              {meal.items.length > 0 && (
                <ul className="nutrition-view-items">
                  {meal.items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        {item.instructions && (
                          <small className="training-muted" style={{ display: 'block' }}>
                            {item.instructions}
                          </small>
                        )}
                      </div>
                      <span className="nutrition-qty-pill">
                        {formatQuantity(item.quantity)} {item.unit}
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