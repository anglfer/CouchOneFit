import { useState } from 'react';
import { Icon } from '../../../components/Icon';
import { emptyItem, emptyMeal } from '../services/nutrition';
import type { NutritionDocument, NutritionItem, NutritionMeal } from '../types/nutrition';
import type { NutritionFieldErrors } from '../utils/validation';

interface Props {
  value: NutritionDocument;
  onChange: (next: NutritionDocument) => void;
  errors: NutritionFieldErrors;
  showAllErrors?: boolean;
  disabled?: boolean;
}

const COMMON_UNITS = ['g', 'ml', 'pza', 'taza', 'cda', 'cdta', 'scoop', 'rebanada', 'porción'];

const parseOptionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function NutritionEditor({
  value,
  onChange,
  errors,
  showAllErrors = false,
  disabled,
}: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  const isShown = (key: string, msg?: string) => Boolean(msg && (showAllErrors || touched[key]));

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
    <div className="nutrition-editor">
      <datalist id="nutrition-common-units">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <section className="training-panel">
        <div className="training-section-head" style={{ marginBottom: 0 }}>
          <div>
            <span className="ws-eyebrow">DATOS GENERALES</span>
            <h3 className="training-panel-title">Identificación y metas diarias</h3>
          </div>
          <small className="training-muted">Los objetivos calóricos y de macros son opcionales.</small>
        </div>

        <div>
          <label htmlFor="nutrition-plan-name">
            Nombre del plan alimenticio *
            <input
              id="nutrition-plan-name"
              type="text"
              maxLength={150}
              disabled={disabled}
              value={value.name}
              aria-invalid={isShown('name', errors.name)}
              onBlur={() => markTouched('name')}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Ej. Plan recomposición corporal — Fase 1"
            />
          </label>
          {isShown('name', errors.name) && (
            <span className="nutrition-field-error" role="alert">
              {errors.name}
            </span>
          )}
        </div>

        <div className="training-fields">
          <div>
            <label htmlFor="nutrition-calories">
              Calorías (kcal)
              <input
                id="nutrition-calories"
                type="number"
                min={1}
                max={15000}
                step={1}
                disabled={disabled}
                value={value.caloriesTarget ?? ''}
                aria-invalid={isShown('caloriesTarget', errors.caloriesTarget)}
                onBlur={() => markTouched('caloriesTarget')}
                onChange={(e) =>
                  onChange({ ...value, caloriesTarget: parseOptionalNumber(e.target.value) })
                }
                placeholder="Ej. 2200"
              />
            </label>
            {isShown('caloriesTarget', errors.caloriesTarget) && (
              <span className="nutrition-field-error" role="alert">
                {errors.caloriesTarget}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nutrition-protein">
              Proteína (g)
              <input
                id="nutrition-protein"
                type="number"
                min={0}
                max={1000}
                step={1}
                disabled={disabled}
                value={value.proteinTargetG ?? ''}
                aria-invalid={isShown('proteinTargetG', errors.proteinTargetG)}
                onBlur={() => markTouched('proteinTargetG')}
                onChange={(e) =>
                  onChange({ ...value, proteinTargetG: parseOptionalNumber(e.target.value) })
                }
                placeholder="Ej. 160"
              />
            </label>
            {isShown('proteinTargetG', errors.proteinTargetG) && (
              <span className="nutrition-field-error" role="alert">
                {errors.proteinTargetG}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nutrition-carbs">
              Carbohidratos (g)
              <input
                id="nutrition-carbs"
                type="number"
                min={0}
                max={1500}
                step={1}
                disabled={disabled}
                value={value.carbsTargetG ?? ''}
                aria-invalid={isShown('carbsTargetG', errors.carbsTargetG)}
                onBlur={() => markTouched('carbsTargetG')}
                onChange={(e) =>
                  onChange({ ...value, carbsTargetG: parseOptionalNumber(e.target.value) })
                }
                placeholder="Ej. 240"
              />
            </label>
            {isShown('carbsTargetG', errors.carbsTargetG) && (
              <span className="nutrition-field-error" role="alert">
                {errors.carbsTargetG}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nutrition-fat">
              Grasas (g)
              <input
                id="nutrition-fat"
                type="number"
                min={0}
                max={1000}
                step={1}
                disabled={disabled}
                value={value.fatTargetG ?? ''}
                aria-invalid={isShown('fatTargetG', errors.fatTargetG)}
                onBlur={() => markTouched('fatTargetG')}
                onChange={(e) =>
                  onChange({ ...value, fatTargetG: parseOptionalNumber(e.target.value) })
                }
                placeholder="Ej. 65"
              />
            </label>
            {isShown('fatTargetG', errors.fatTargetG) && (
              <span className="nutrition-field-error" role="alert">
                {errors.fatTargetG}
              </span>
            )}
          </div>
        </div>
      </section>

      {errors.mealsGeneral && (
        <div className="ws-alert" data-tone="bad" role="alert">
          {errors.mealsGeneral}
        </div>
      )}

      {value.meals.map((meal, mealIndex) => {
        const mealErr = errors.meals[meal.id];
        const mealNameKey = `meal:${meal.id}:name`;
        const showMealNameErr = isShown(mealNameKey, mealErr?.name);
        const mealHasVisibleError =
          showMealNameErr ||
          Boolean(mealErr?.itemsGeneral) ||
          Boolean(
            showAllErrors &&
              mealErr &&
              Object.keys(mealErr.items).length > 0,
          );

        return (
          <section
            key={meal.id}
            className="nutrition-meal-card"
            data-invalid={mealHasVisibleError}
          >
            <div className="nutrition-meal-head">
              <div className="nutrition-meal-title-row">
                <span className="training-order" aria-hidden="true">
                  {mealIndex + 1}
                </span>
                <div>
                  <label>
                    Tiempo de comida *
                    <input
                      type="text"
                      maxLength={100}
                      disabled={disabled}
                      value={meal.name}
                      aria-invalid={showMealNameErr}
                      onBlur={() => markTouched(mealNameKey)}
                      onChange={(e) =>
                        updateMeal(meal.id, (m) => ({ ...m, name: e.target.value }))
                      }
                      placeholder="Ej. Desayuno, Colación, Comida..."
                    />
                  </label>
                  {showMealNameErr && (
                    <span className="nutrition-field-error" role="alert">
                      {mealErr?.name}
                    </span>
                  )}
                </div>
              </div>

              <button
  type="button"
  className="training-icon-btn"
  data-danger
  aria-label={`Eliminar ${meal.name || `comida ${mealIndex + 1}`}`}
  title="Quitar tiempo de comida"
  disabled={disabled || value.meals.length <= 1}
  onClick={() => removeMeal(meal.id)}
>
  ✕
</button>
            </div>

            <div>
              <label>
                Indicaciones de la comida (opcional)
                <input
                  type="text"
                  maxLength={2000}
                  disabled={disabled}
                  value={meal.instructions ?? ''}
                  aria-invalid={Boolean(mealErr?.instructions)}
                  onChange={(e) =>
                    updateMeal(meal.id, (m) => ({
                      ...m,
                      instructions: e.target.value.trim() ? e.target.value : null,
                    }))
                  }
                  placeholder="Horario sugerido, hidratación o forma de preparación"
                />
              </label>
              {mealErr?.instructions && (
                <span className="nutrition-field-error" role="alert">
                  {mealErr.instructions}
                </span>
              )}
            </div>

            {mealErr?.itemsGeneral && (
              <span className="nutrition-field-error" role="alert">
                {mealErr.itemsGeneral}
              </span>
            )}

            <div className="nutrition-items-list">
              {meal.items.map((item) => {
                const itemErr = mealErr?.items[item.id];
                const nameKey = `item:${item.id}:name`;
                const qtyKey = `item:${item.id}:quantity`;
                const unitKey = `item:${item.id}:unit`;

                return (
                  <div key={item.id} className="nutrition-item-row">
                    <div className="nutrition-item-cell">
                      <label>Alimento *</label>
                      <input
                        type="text"
                        maxLength={150}
                        disabled={disabled}
                        value={item.name}
                        aria-invalid={isShown(nameKey, itemErr?.name)}
                        onBlur={() => markTouched(nameKey)}
                        onChange={(e) =>
                          updateItem(meal.id, item.id, (i) => ({ ...i, name: e.target.value }))
                        }
                        placeholder="Ej. Pechuga de pollo"
                      />
                      {isShown(nameKey, itemErr?.name) && (
                        <span className="nutrition-field-error" role="alert">
                          {itemErr?.name}
                        </span>
                      )}
                    </div>

                    <div className="nutrition-item-cell">
                      <label>Cantidad *</label>
                      <input
                        type="number"
                        min={0.1}
                        max={10000}
                        step={0.1}
                        disabled={disabled}
                        value={item.quantity === 0 ? '' : item.quantity}
                        aria-invalid={isShown(qtyKey, itemErr?.quantity)}
                        onBlur={() => markTouched(qtyKey)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw.trim() === '' ? 0 : Number(raw);
                          updateItem(meal.id, item.id, (i) => ({
                            ...i,
                            quantity: Number.isFinite(parsed) ? parsed : 0,
                          }));
                        }}
                        placeholder="150"
                      />
                      {isShown(qtyKey, itemErr?.quantity) && (
                        <span className="nutrition-field-error" role="alert">
                          {itemErr?.quantity}
                        </span>
                      )}
                    </div>

                    <div className="nutrition-item-cell">
                      <label>Unidad *</label>
                      <input
                        type="text"
                        list="nutrition-common-units"
                        maxLength={50}
                        disabled={disabled}
                        value={item.unit}
                        aria-invalid={isShown(unitKey, itemErr?.unit)}
                        onBlur={() => markTouched(unitKey)}
                        onChange={(e) =>
                          updateItem(meal.id, item.id, (i) => ({ ...i, unit: e.target.value }))
                        }
                        placeholder="g, ml, pza"
                      />
                      {isShown(unitKey, itemErr?.unit) && (
                        <span className="nutrition-field-error" role="alert">
                          {itemErr?.unit}
                        </span>
                      )}
                    </div>

                    <div className="nutrition-item-cell">
                      <label>Nota (opcional)</label>
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
                        placeholder="En crudo, cocido..."
                      />
                    </div>

                    <div className="nutrition-item-cell" style={{ alignSelf: 'end' }}>
                      <button
                        type="button"
                        className="training-icon-btn"
                        data-danger
                        aria-label="Eliminar alimento"
                        title="Eliminar alimento"
                        disabled={disabled || meal.items.length <= 1}
                        onClick={() =>
                          updateMeal(meal.id, (m) => ({
                            ...m,
                            items: m.items.filter((x) => x.id !== item.id),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {meal.items.length < 30 && (
              <div>
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
              </div>
            )}
          </section>
        );
      })}

      {value.meals.length < 12 && (
        <button
          type="button"
          className="ws-plain training-add-exercise"
          disabled={disabled}
          onClick={addMeal}
        >
          <Icon name="plus" size={18} /> Agregar tiempo de comida
        </button>
      )}
    </div>
  );
}