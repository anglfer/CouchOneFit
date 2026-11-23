import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { confirmDialog } from '../../../services/confirm';
import { emptyItem, emptyMeal } from '../services/nutrition';
import type {
  NutritionDocument,
  NutritionItem,
  NutritionMeal,
  NutritionMealCategory,
  NutritionPeriWorkout,
} from '../types/nutrition';
import {
  COMMON_UNITS,
  MEAL_CATEGORY_OPTIONS,
  MEAL_TEMPLATES,
  calculateFoodMacros,
  findCatalogMatch,
  formatMealItemsCount,
  instantiateMealTemplate,
  scaleCustomRecipeIngredients,
  scaleRecipeIngredients,
  summarizeDocumentMacros,
  summarizeItemsMacros,
} from '../utils/foodCatalog';
import { suggestMealItems } from '../utils/mealFiller';
import type { NutritionFieldErrors } from '../utils/validation';
import FoodPickerModal from './FoodPickerModal';
import MacroBar from './MacroBar';

interface Props {
  value: NutritionDocument;
  onChange: (next: NutritionDocument) => void;
  errors: NutritionFieldErrors;
  showAllErrors?: boolean;
  disabled?: boolean;
  onOpenAssistant?: () => void;
}

const QUICK_GUIDANCE_SNIPPETS: ReadonlyArray<[string, string]> = [
  [
    '+ Regla 80/20',
    'Prioriza ~80% de alimentos enteros y mínimamente procesados; reserva ~20% flexible para sostener adherencia.',
  ],
  [
    '+ Pesaje en crudo',
    'Pesa proteínas en crudo y cereales/arroz ya cocidos salvo que la nota indique en seco.',
  ],
  [
    '+ Hidratación',
    'Distribuye el agua durante el día y prioriza bebidas sin calorías añadidas.',
  ],
  [
    '+ Verdura diaria',
    'Incluye al menos 3 porciones de verdura verde y 2 de fruta entera variando colores.',
  ],
];

const parseOptionalNumber = (raw: string): number | null => {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const emptyPeriWorkout = (): NutritionPeriWorkout => ({
  preCarbsG: 40,
  preProteinG: 30,
  preFatG: 10,
  postCarbsG: 50,
  postProteinG: 35,
  postFatG: 10,
  intraCarbsG: 0,
  notes: null,
});

function moveInArray<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= list.length) return [...list];
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

export default function NutritionEditor({
  value,
  onChange,
  errors,
  showAllErrors = false,
  disabled,
  onOpenAssistant,
}: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pickerMealId, setPickerMealId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [collapsedMeals, setCollapsedMeals] = useState<Record<string, boolean>>(
    {}
  );

  const markTouched = (key: string) =>
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  const isShown = (key: string, msg?: string) =>
    Boolean(msg && (showAllErrors || touched[key]));

  const docSummary = useMemo(() => summarizeDocumentMacros(value), [value]);

  const markModifiedIfSuggested = (
    next: NutritionDocument
  ): NutritionDocument =>
    next.suggestionMeta && !next.suggestionMeta.modifiedByProfessional
      ? {
          ...next,
          suggestionMeta: {
            ...next.suggestionMeta,
            modifiedByProfessional: true,
          },
        }
      : next;

  const emitChange = (next: NutritionDocument) => {
    onChange(markModifiedIfSuggested(next));
  };

  const updateMeal = (
    mealId: string,
    updater: (meal: NutritionMeal) => NutritionMeal
  ) => {
    emitChange({
      ...value,
      meals: value.meals.map((m) => (m.id === mealId ? updater(m) : m)),
    });
  };

  const removeMeal = (mealId: string) => {
    emitChange({
      ...value,
      meals: value.meals.filter((m) => m.id !== mealId),
    });
  };

  const duplicateMeal = (mealIndex: number) => {
    if (value.meals.length >= 12) return;
    const src = value.meals[mealIndex];
    const copy: NutritionMeal = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (copia)`.slice(0, 100),
      items: src.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
    };
    const nextMeals = [...value.meals];
    nextMeals.splice(mealIndex + 1, 0, copy);
    emitChange({ ...value, meals: nextMeals });
  };

  const addMeal = () => {
    if (value.meals.length >= 12) return;
    emitChange({
      ...value,
      meals: [...value.meals, emptyMeal(`Comida ${value.meals.length + 1}`)],
    });
  };

  const insertTemplateMeal = (templateId: string) => {
    if (!templateId || value.meals.length >= 12) return;
    const template = MEAL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const meal = instantiateMealTemplate(template);
    const existingNames = new Set(value.meals.map((m) => m.name.toLowerCase()));
    if (existingNames.has(meal.name.toLowerCase())) {
      meal.name = `${meal.name} ${value.meals.length + 1}`.slice(0, 100);
    }
    emitChange({ ...value, meals: [...value.meals, meal] });
    setSelectedTemplateId('');
  };

  // Meal guide: explicit meal targets, else an even share of the daily targets.
  const mealGuide = (meal: NutritionMeal) => {
    if (meal.targetCalories != null)
      return {
        category: meal.category,
        targetProteinG: meal.targetProteinG ?? 0,
        targetCarbsG: meal.targetCarbsG ?? 0,
        targetFatG: meal.targetFatG ?? 0,
      };
    const n = value.meals.length || 1;
    if (value.proteinTargetG == null && value.carbsTargetG == null) return null;
    return {
      category: meal.category,
      targetProteinG: Math.round((value.proteinTargetG ?? 0) / n),
      targetCarbsG: Math.round((value.carbsTargetG ?? 0) / n),
      targetFatG: Math.round((value.fatTargetG ?? 0) / n),
    };
  };
  const restrictions = value.suggestionMeta?.restrictions ?? [];

  const fillMeal = async (meal: NutritionMeal) => {
    const guide = mealGuide(meal);
    const items = guide && suggestMealItems(guide, restrictions);
    if (!items) return;
    if (
      meal.items.length > 0 &&
      !(await confirmDialog({
        title: `¿Reemplazar los alimentos de ${meal.name || 'esta comida'}?`,
        message:
          'Se propondrán alimentos y porciones que cubren la guía de esta comida. Podrás ajustarlos después.',
        confirmLabel: 'Reemplazar',
        cancelLabel: 'Cancelar',
      }))
    )
      return;
    updateMeal(meal.id, (m) => ({ ...m, items }));
  };

  const fillEmptyMeals = () =>
    emitChange({
      ...value,
      meals: value.meals.map((m) => {
        const guide = m.items.length ? null : mealGuide(m);
        return guide
          ? { ...m, items: suggestMealItems(guide, restrictions) ?? [] }
          : m;
      }),
    });
  const canFillEmpty = value.meals.some(
    (m) => m.items.length === 0 && mealGuide(m)
  );

  const updateItem = (
    mealId: string,
    itemId: string,
    updater: (item: NutritionItem) => NutritionItem
  ) => {
    updateMeal(mealId, (meal) => ({
      ...meal,
      items: meal.items.map((i) => (i.id === itemId ? updater(i) : i)),
    }));
  };

  const macroKcal =
    value.proteinTargetG !== null ||
    value.carbsTargetG !== null ||
    value.fatTargetG !== null
      ? Math.round(
          (value.proteinTargetG ?? 0) * 4 +
            (value.carbsTargetG ?? 0) * 4 +
            (value.fatTargetG ?? 0) * 9
        )
      : null;

  const showSyncCalories =
    macroKcal !== null &&
    macroKcal > 0 &&
    (value.caloriesTarget === null ||
      Math.abs(macroKcal - value.caloriesTarget) > 15);

  const pickerMeal = pickerMealId
    ? (value.meals.find((m) => m.id === pickerMealId) ?? null)
    : null;

  const appendGuidance = (snippet: string) => {
    const current = value.generalInstructions?.trim() ?? '';
    if (current.includes(snippet)) return;
    const next = current ? `${current}\n${snippet}` : snippet;
    emitChange({ ...value, generalInstructions: next.slice(0, 3000) });
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
            <h3 className="training-panel-title">
              Identificación y metas del plan
            </h3>
            <p className="text-xs text-(--ws-muted)">
              Define los objetivos diarios y las guías generales antes de
              detallar las comidas.
            </p>
          </div>
          <div className="training-actions">
            {value.suggestionMeta && (
              <span className="nutrition-origin-pill">
                {value.suggestionMeta.modifiedByProfessional
                  ? 'Base sugerida · ajustado por profesional'
                  : 'Generado con el asistente'}
              </span>
            )}
            {onOpenAssistant && (
              <button
                type="button"
                className="ws-btn"
                disabled={disabled}
                onClick={onOpenAssistant}
              >
                <Icon name="sliders" size={15} /> Asistente de cálculo
                (fórmulas)
              </button>
            )}
          </div>
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
              aria-invalid={isShown('name', errors.name) ? 'true' : 'false'}
              aria-describedby={
                isShown('name', errors.name)
                  ? 'nutrition-plan-name-err'
                  : undefined
              }
              onBlur={() => markTouched('name')}
              onChange={(e) => emitChange({ ...value, name: e.target.value })}
              placeholder="Ej. Plan recomposición corporal — Fase 1"
            />
          </label>
          {isShown('name', errors.name) && (
            <span
              id="nutrition-plan-name-err"
              className="nutrition-field-error"
            >
              Error: {errors.name}
            </span>
          )}
        </div>

        <div className="nutrition-targets-grid">
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
                aria-invalid={
                  isShown('caloriesTarget', errors.caloriesTarget)
                    ? 'true'
                    : 'false'
                }
                aria-describedby={
                  isShown('caloriesTarget', errors.caloriesTarget)
                    ? 'nutrition-calories-err'
                    : undefined
                }
                onBlur={() => markTouched('caloriesTarget')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    caloriesTarget: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 2200"
              />
            </label>
            {isShown('caloriesTarget', errors.caloriesTarget) && (
              <span
                id="nutrition-calories-err"
                className="nutrition-field-error"
              >
                Error: {errors.caloriesTarget}
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
                aria-invalid={
                  isShown('proteinTargetG', errors.proteinTargetG)
                    ? 'true'
                    : 'false'
                }
                aria-describedby={
                  isShown('proteinTargetG', errors.proteinTargetG)
                    ? 'nutrition-protein-err'
                    : undefined
                }
                onBlur={() => markTouched('proteinTargetG')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    proteinTargetG: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 160"
              />
            </label>
            {isShown('proteinTargetG', errors.proteinTargetG) && (
              <span
                id="nutrition-protein-err"
                className="nutrition-field-error"
              >
                Error: {errors.proteinTargetG}
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
                aria-invalid={
                  isShown('carbsTargetG', errors.carbsTargetG)
                    ? 'true'
                    : 'false'
                }
                aria-describedby={
                  isShown('carbsTargetG', errors.carbsTargetG)
                    ? 'nutrition-carbs-err'
                    : undefined
                }
                onBlur={() => markTouched('carbsTargetG')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    carbsTargetG: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 240"
              />
            </label>
            {isShown('carbsTargetG', errors.carbsTargetG) && (
              <span id="nutrition-carbs-err" className="nutrition-field-error">
                Error: {errors.carbsTargetG}
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
                aria-invalid={
                  isShown('fatTargetG', errors.fatTargetG) ? 'true' : 'false'
                }
                aria-describedby={
                  isShown('fatTargetG', errors.fatTargetG)
                    ? 'nutrition-fat-err'
                    : undefined
                }
                onBlur={() => markTouched('fatTargetG')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    fatTargetG: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 65"
              />
            </label>
            {isShown('fatTargetG', errors.fatTargetG) && (
              <span id="nutrition-fat-err" className="nutrition-field-error">
                Error: {errors.fatTargetG}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nutrition-fiber">
              Fibra (g)
              <input
                id="nutrition-fiber"
                type="number"
                min={0}
                max={150}
                step={1}
                disabled={disabled}
                value={value.fiberTargetG ?? ''}
                aria-invalid={
                  isShown('fiberTargetG', errors.fiberTargetG)
                    ? 'true'
                    : 'false'
                }
                onBlur={() => markTouched('fiberTargetG')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    fiberTargetG: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 30"
              />
            </label>
            {isShown('fiberTargetG', errors.fiberTargetG) && (
              <span className="nutrition-field-error">
                Error: {errors.fiberTargetG}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nutrition-hydration">
              Hidratación (ml)
              <input
                id="nutrition-hydration"
                type="number"
                min={0}
                max={10000}
                step={50}
                disabled={disabled}
                value={value.hydrationTargetMl ?? ''}
                aria-invalid={
                  isShown('hydrationTargetMl', errors.hydrationTargetMl)
                    ? 'true'
                    : 'false'
                }
                onBlur={() => markTouched('hydrationTargetMl')}
                onChange={(e) =>
                  emitChange({
                    ...value,
                    hydrationTargetMl: parseOptionalNumber(e.target.value),
                  })
                }
                placeholder="Ej. 2500"
              />
            </label>
            {isShown('hydrationTargetMl', errors.hydrationTargetMl) && (
              <span className="nutrition-field-error">
                Error: {errors.hydrationTargetMl}
              </span>
            )}
          </div>
        </div>

        {showSyncCalories && (
          <div className="nutrition-sync-row">
            <span>
              La suma energética de P/C/G equivale a{' '}
              <strong>{macroKcal} kcal</strong>.
            </span>
            <button
              type="button"
              className="ws-btn"
              disabled={disabled}
              onClick={() =>
                emitChange({ ...value, caloriesTarget: macroKcal })
              }
            >
              Sincronizar calorías ({macroKcal} kcal)
            </button>
          </div>
        )}

        <MacroBar
          caloriesTarget={value.caloriesTarget}
          proteinG={value.proteinTargetG}
          carbsG={value.carbsTargetG}
          fatG={value.fatTargetG}
          planned={docSummary}
        />

        <div className="nutrition-accordions">
          <details className="nutrition-accordion">
            <summary>
              <span>
                Días de descanso / Ciclado de carbohidratos (opcional)
              </span>
              {value.restDayTargets && (
                <span className="ws-chip ml-auto">
                  Configurado · {value.restDayTargets.caloriesTarget} kcal
                </span>
              )}
            </summary>
            <div className="nutrition-accordion-body">
              <label className="nutrition-check-row">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={Boolean(value.restDayTargets)}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      emitChange({ ...value, restDayTargets: null });
                      return;
                    }
                    const p = value.proteinTargetG ?? 150;
                    const c = Math.round((value.carbsTargetG ?? 220) * 0.8);
                    const f = value.fatTargetG ?? 60;
                    emitChange({
                      ...value,
                      restDayTargets: {
                        caloriesTarget: p * 4 + c * 4 + f * 9,
                        proteinTargetG: p,
                        carbsTargetG: c,
                        fatTargetG: f,
                      },
                    });
                  }}
                />
                <span>
                  Definir metas diferenciadas para días sin entrenamiento
                </span>
              </label>

              {value.restDayTargets && (
                <div className="nutrition-targets-grid">
                  <label>
                    Calorías descanso (kcal)
                    <input
                      type="number"
                      min={0}
                      max={15000}
                      disabled={disabled}
                      value={value.restDayTargets.caloriesTarget}
                      aria-invalid={
                        errors.restCaloriesTarget ? 'true' : 'false'
                      }
                      onChange={(e) =>
                        emitChange({
                          ...value,
                          restDayTargets: {
                            ...value.restDayTargets!,
                            caloriesTarget: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Proteína descanso (g)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      disabled={disabled}
                      value={value.restDayTargets.proteinTargetG}
                      onChange={(e) =>
                        emitChange({
                          ...value,
                          restDayTargets: {
                            ...value.restDayTargets!,
                            proteinTargetG: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Carbohidratos descanso (g)
                    <input
                      type="number"
                      min={0}
                      max={1500}
                      disabled={disabled}
                      value={value.restDayTargets.carbsTargetG}
                      onChange={(e) =>
                        emitChange({
                          ...value,
                          restDayTargets: {
                            ...value.restDayTargets!,
                            carbsTargetG: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Grasas descanso (g)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      disabled={disabled}
                      value={value.restDayTargets.fatTargetG}
                      onChange={(e) =>
                        emitChange({
                          ...value,
                          restDayTargets: {
                            ...value.restDayTargets!,
                            fatTargetG: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </details>

          <details className="nutrition-accordion">
            <summary>
              <span>Nutrición peri-entreno (pre / intra / post opcional)</span>
              {value.periWorkout && (
                <span className="ws-chip ml-auto">Configurado · pre/post</span>
              )}
            </summary>
            <div className="nutrition-accordion-body">
              <label className="nutrition-check-row">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={Boolean(value.periWorkout)}
                  onChange={(e) =>
                    emitChange({
                      ...value,
                      periWorkout: e.target.checked ? emptyPeriWorkout() : null,
                    })
                  }
                />
                <span>Incluir guía específica alrededor del entrenamiento</span>
              </label>

              {value.periWorkout && (
                <>
                  <div className="nutrition-targets-grid">
                    <label>
                      Pre · Proteína (g)
                      <input
                        type="number"
                        min={0}
                        max={500}
                        disabled={disabled}
                        value={value.periWorkout.preProteinG}
                        onChange={(e) =>
                          emitChange({
                            ...value,
                            periWorkout: {
                              ...value.periWorkout!,
                              preProteinG: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Pre · Carbos (g)
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        disabled={disabled}
                        value={value.periWorkout.preCarbsG}
                        onChange={(e) =>
                          emitChange({
                            ...value,
                            periWorkout: {
                              ...value.periWorkout!,
                              preCarbsG: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Intra · Carbos (g)
                      <input
                        type="number"
                        min={0}
                        max={500}
                        disabled={disabled}
                        value={value.periWorkout.intraCarbsG}
                        onChange={(e) =>
                          emitChange({
                            ...value,
                            periWorkout: {
                              ...value.periWorkout!,
                              intraCarbsG: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Post · Proteína (g)
                      <input
                        type="number"
                        min={0}
                        max={500}
                        disabled={disabled}
                        value={value.periWorkout.postProteinG}
                        onChange={(e) =>
                          emitChange({
                            ...value,
                            periWorkout: {
                              ...value.periWorkout!,
                              postProteinG: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Post · Carbos (g)
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        disabled={disabled}
                        value={value.periWorkout.postCarbsG}
                        onChange={(e) =>
                          emitChange({
                            ...value,
                            periWorkout: {
                              ...value.periWorkout!,
                              postCarbsG: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Notas peri-entreno
                    <input
                      type="text"
                      maxLength={1000}
                      disabled={disabled}
                      value={value.periWorkout.notes ?? ''}
                      onChange={(e) =>
                        emitChange({
                          ...value,
                          periWorkout: {
                            ...value.periWorkout!,
                            notes: e.target.value.trim()
                              ? e.target.value
                              : null,
                          },
                        })
                      }
                      placeholder="Ventana sugerida, hidratación o tolerancia digestiva"
                    />
                  </label>
                </>
              )}
            </div>
          </details>

          <details className="nutrition-accordion">
            <summary>
              <span>Indicaciones generales del profesional (opcional)</span>
              {value.generalInstructions?.trim() && (
                <span className="ws-chip ml-auto">Con indicaciones</span>
              )}
            </summary>
            <div className="nutrition-accordion-body">
              <div className="nutrition-group-pills">
                {QUICK_GUIDANCE_SNIPPETS.map(([label, text]) => (
                  <button
                    key={label}
                    type="button"
                    className="ws-plain nutrition-group-pill"
                    disabled={disabled}
                    onClick={() => appendGuidance(text)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                Instrucciones generales visibles para el cliente
                <textarea
                  rows={3}
                  maxLength={3000}
                  disabled={disabled}
                  value={value.generalInstructions ?? ''}
                  aria-invalid={errors.generalInstructions ? 'true' : 'false'}
                  onChange={(e) =>
                    emitChange({
                      ...value,
                      generalInstructions: e.target.value.trim()
                        ? e.target.value
                        : null,
                    })
                  }
                  placeholder="Indicaciones de preparación, flexibilidad, hidratación o adherencia..."
                />
              </label>
              {errors.generalInstructions && (
                <span className="nutrition-field-error">
                  Error: {errors.generalInstructions}
                </span>
              )}
            </div>
          </details>
        </div>
      </section>

      <div className="nutrition-meals-toolbar">
        <div>
          <h3 className="training-panel-title">
            Tiempos de comida ({value.meals.length}/12)
          </h3>
        </div>
        <div className="nutrition-meals-toolbar-actions">
          {value.meals.length > 1 && (
            <button
              type="button"
              className="ws-btn"
              onClick={() => {
                const anyCollapsed = value.meals.some(
                  (m) => collapsedMeals[m.id]
                );
                setCollapsedMeals(
                  anyCollapsed
                    ? {}
                    : Object.fromEntries(value.meals.map((m) => [m.id, true]))
                );
              }}
            >
              {value.meals.some((m) => collapsedMeals[m.id])
                ? 'Expandir todas'
                : 'Contraer todas'}
            </button>
          )}
          <select
            aria-label="Insertar plantilla de comida"
            disabled={disabled || value.meals.length >= 12}
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              insertTemplateMeal(e.target.value);
            }}
          >
            <option value="">Insertar plantilla de comida…</option>
            {MEAL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ws-btn"
            disabled={disabled || value.meals.length >= 12}
            onClick={addMeal}
          >
            <Icon name="plus" size={15} /> Nuevo tiempo
          </button>
          {canFillEmpty && (
            <button
              type="button"
              className="ws-btn"
              data-variant="primary"
              disabled={disabled}
              onClick={fillEmptyMeals}
              title="Propone alimentos y porciones para las comidas vacías según su guía"
            >
              <Icon name="sparkle" size={15} /> Llenar comidas vacías
            </button>
          )}
        </div>
      </div>

      {errors.mealsGeneral && (
        <div className="ws-alert" data-tone="bad" role="alert">
          {errors.mealsGeneral}
        </div>
      )}

      {value.meals.map((meal, mealIndex) => {
        const mealErr = errors.meals[meal.id];
        const mealNameKey = `meal:${meal.id}:name`;
        const showMealNameErr = isShown(mealNameKey, mealErr?.name);
        const mealSummary = summarizeItemsMacros(meal.items);
        const guide = mealGuide(meal);
        const mealHasVisibleError =
          showMealNameErr ||
          Boolean(mealErr?.itemsGeneral && showAllErrors) ||
          Boolean(
            showAllErrors && mealErr && Object.keys(mealErr.items).length > 0
          );
        const mealCollapsed =
          Boolean(collapsedMeals[meal.id]) && !mealHasVisibleError;

        return (
          <section
            key={meal.id}
            className="nutrition-meal-card"
            data-invalid={mealHasVisibleError}
          >
            <div className="nutrition-meal-head">
              <div className="nutrition-meal-title-row">
                <button
                  type="button"
                  className="ws-plain training-icon-btn"
                  aria-expanded={!mealCollapsed}
                  aria-label={
                    mealCollapsed
                      ? `Expandir ${meal.name || `comida ${mealIndex + 1}`}`
                      : `Contraer ${meal.name || `comida ${mealIndex + 1}`}`
                  }
                  onClick={() =>
                    setCollapsedMeals((prev) => ({
                      ...prev,
                      [meal.id]: !mealCollapsed,
                    }))
                  }
                >
                  <Icon
                    name={mealCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={16}
                  />
                </button>
                <span className="training-order" aria-hidden="true">
                  {mealIndex + 1}
                </span>
                {mealCollapsed ? (
                  <div className="min-w-0 flex-1 py-1">
                    <strong className="block truncate">
                      {meal.name || `Comida ${mealIndex + 1}`}
                      {meal.scheduleTime ? ` · ${meal.scheduleTime}` : ''}
                    </strong>
                    <span className="text-xs text-(--ws-muted) tabular-nums">
                      {formatMealItemsCount(meal.items)}
                      {mealSummary.itemsWithMacros > 0
                        ? ` · ${mealSummary.calories} kcal · P ${Math.round(mealSummary.proteinG)}g · C ${Math.round(mealSummary.carbsG)}g · G ${Math.round(mealSummary.fatG)}g`
                        : ''}
                    </span>
                  </div>
                ) : (
                  <div className="nutrition-meal-fields-grid">
                    <div>
                      <label>
                        Tiempo de comida *
                        <input
                          type="text"
                          maxLength={100}
                          disabled={disabled}
                          value={meal.name}
                          aria-invalid={showMealNameErr ? 'true' : 'false'}
                          aria-describedby={
                            showMealNameErr
                              ? `meal-name-err-${meal.id}`
                              : undefined
                          }
                          onBlur={() => markTouched(mealNameKey)}
                          onChange={(e) =>
                            updateMeal(meal.id, (m) => ({
                              ...m,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Ej. Desayuno, Colación, Pre-entreno..."
                        />
                      </label>
                      {showMealNameErr && (
                        <span
                          id={`meal-name-err-${meal.id}`}
                          className="nutrition-field-error"
                        >
                          Error: {mealErr?.name}
                        </span>
                      )}
                    </div>

                    <label>
                      Categoría
                      <select
                        disabled={disabled}
                        value={meal.category ?? ''}
                        onChange={(e) =>
                          updateMeal(meal.id, (m) => ({
                            ...m,
                            category: e.target.value
                              ? (e.target.value as NutritionMealCategory)
                              : null,
                          }))
                        }
                      >
                        <option value="">Sin categoría</option>
                        {MEAL_CATEGORY_OPTIONS.map(([cat, label]) => (
                          <option key={cat} value={cat}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Horario sugerido
                      <input
                        type="text"
                        maxLength={40}
                        disabled={disabled}
                        value={meal.scheduleTime ?? ''}
                        onChange={(e) =>
                          updateMeal(meal.id, (m) => ({
                            ...m,
                            scheduleTime: e.target.value.trim()
                              ? e.target.value
                              : null,
                          }))
                        }
                        placeholder="Ej. 08:00 o 60 min pre"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="training-icon-row">
                <button
                  type="button"
                  className="ws-plain training-icon-btn"
                  aria-label={`Subir ${meal.name || `comida ${mealIndex + 1}`}`}
                  title="Mover arriba"
                  disabled={disabled || mealIndex === 0}
                  onClick={() =>
                    emitChange({
                      ...value,
                      meals: moveInArray(value.meals, mealIndex, -1),
                    })
                  }
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  type="button"
                  className="ws-plain training-icon-btn"
                  aria-label={`Bajar ${meal.name || `comida ${mealIndex + 1}`}`}
                  title="Mover abajo"
                  disabled={disabled || mealIndex === value.meals.length - 1}
                  onClick={() =>
                    emitChange({
                      ...value,
                      meals: moveInArray(value.meals, mealIndex, 1),
                    })
                  }
                >
                  <Icon name="chevron-down" size={16} />
                </button>
                <button
                  type="button"
                  className="ws-plain training-icon-btn"
                  aria-label={`Duplicar ${meal.name || `comida ${mealIndex + 1}`}`}
                  title="Duplicar comida"
                  disabled={disabled || value.meals.length >= 12}
                  onClick={() => duplicateMeal(mealIndex)}
                >
                  <Icon name="copy" size={15} />
                </button>
                <button
                  type="button"
                  className="ws-plain training-icon-btn"
                  data-danger
                  aria-label={`Eliminar ${meal.name || `comida ${mealIndex + 1}`}`}
                  title="Quitar tiempo de comida"
                  disabled={disabled || value.meals.length <= 1}
                  onClick={() => removeMeal(meal.id)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>

            {!mealCollapsed && (mealSummary.itemsWithMacros > 0 || guide) && (
              <div className="nutrition-meal-progress">
                {(
                  [
                    ['Proteína', mealSummary.proteinG, guide?.targetProteinG],
                    ['Carbos', mealSummary.carbsG, guide?.targetCarbsG],
                    ['Grasas', mealSummary.fatG, guide?.targetFatG],
                  ] as const
                ).map(([label, got, goal]) => {
                  const ratio = goal ? got / goal : 0;
                  return (
                    <div
                      key={label}
                      className="nutrition-progress-chip"
                      data-tone={
                        !goal
                          ? undefined
                          : ratio > 1.15
                            ? 'over'
                            : ratio >= 0.85
                              ? 'ok'
                              : 'under'
                      }
                    >
                      <span>
                        {label}{' '}
                        <strong>
                          {Math.round(got)}
                          {goal ? ` / ${goal}` : ''} g
                        </strong>
                      </span>
                      {goal ? (
                        <progress max={1} value={Math.min(ratio, 1)} />
                      ) : null}
                    </div>
                  );
                })}
                <span className="nutrition-progress-kcal">
                  {mealSummary.calories} kcal
                  {meal.targetCalories ? ` de ${meal.targetCalories}` : ''}
                </span>
              </div>
            )}

            {!mealCollapsed && (
              <div>
                <label>
                  Indicaciones de la comida (opcional)
                  <input
                    type="text"
                    maxLength={2000}
                    disabled={disabled}
                    value={meal.instructions ?? ''}
                    aria-invalid={mealErr?.instructions ? 'true' : 'false'}
                    onChange={(e) =>
                      updateMeal(meal.id, (m) => ({
                        ...m,
                        instructions: e.target.value.trim()
                          ? e.target.value
                          : null,
                      }))
                    }
                    placeholder="Forma de preparación, verduras libres o momento del día"
                  />
                </label>
                {mealErr?.instructions && (
                  <span className="nutrition-field-error">
                    Error: {mealErr.instructions}
                  </span>
                )}
              </div>
            )}

            {mealErr?.itemsGeneral && showAllErrors && (
              <span className="nutrition-field-error">
                Error: {mealErr.itemsGeneral}
              </span>
            )}

            {!mealCollapsed &&
              (meal.items.length === 0 ? (
                <div className="nutrition-meal-empty">
                  <p>
                    {guide
                      ? 'Deja que el asistente proponga alimentos y porciones para esta guía, o elígelos tú.'
                      : 'Elige alimentos del catálogo con macros y sustitutos o agrega uno libre.'}
                  </p>
                  <div className="training-actions">
                    {guide && (
                      <button
                        type="button"
                        className="ws-btn"
                        data-variant="primary"
                        disabled={disabled}
                        onClick={() => void fillMeal(meal)}
                      >
                        <Icon name="sparkle" size={14} /> Sugerir alimentos
                      </button>
                    )}
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={disabled}
                      onClick={() => setPickerMealId(meal.id)}
                    >
                      <Icon name="plus" size={14} /> Elegir alimento o receta
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={disabled}
                      onClick={() =>
                        updateMeal(meal.id, (m) => ({
                          ...m,
                          items: [...m.items, emptyItem('food')],
                        }))
                      }
                    >
                      Alimento libre
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={disabled}
                      onClick={() =>
                        updateMeal(meal.id, (m) => ({
                          ...m,
                          items: [...m.items, emptyItem('recipe')],
                        }))
                      }
                    >
                      <Icon name="bowl" size={14} /> Receta libre
                    </button>
                  </div>
                </div>
              ) : (
                <div className="nutrition-items-list">
                  <div className="nutrition-items-head" aria-hidden="true">
                    <span>Alimento o receta</span>
                    <span>Cantidad</span>
                    <span>Unidad</span>
                    <span />
                  </div>
                  {meal.items.map((item, itemIndex) => {
                    const itemErr = mealErr?.items[item.id];
                    const nameKey = `item:${item.id}:name`;
                    const qtyKey = `item:${item.id}:quantity`;
                    const unitKey = `item:${item.id}:unit`;
                    const isRecipe = item.kind === 'recipe';
                    const ingredientCount = item.recipeIngredients?.length ?? 0;

                    return (
                      <div
                        key={item.id}
                        className="nutrition-item-card"
                        data-kind={isRecipe ? 'recipe' : 'food'}
                      >
                        <div className="nutrition-item-top">
                          <span
                            className="nutrition-kind-badge"
                            data-kind={isRecipe ? 'recipe' : 'food'}
                          >
                            {isRecipe && <Icon name="bowl" size={12} />}
                            {isRecipe ? 'Receta' : 'Alimento'}
                          </span>
                          {item.foodGroup && (
                            <span className="nutrition-inline-group">
                              {item.foodGroup}
                            </span>
                          )}
                          {isRecipe && (
                            <span className="nutrition-item-top-meta">
                              {ingredientCount > 0
                                ? `${ingredientCount} ${ingredientCount === 1 ? 'ingrediente' : 'ingredientes'}`
                                : 'Sin ingredientes capturados'}
                              {' · '}
                              {item.instructions?.trim()
                                ? 'Con preparación'
                                : 'Sin pasos'}
                            </span>
                          )}
                        </div>
                        <div className="nutrition-item-main">
                          <div className="nutrition-item-cell">
                            <label>
                              {isRecipe ? 'Receta *' : 'Alimento *'}{' '}
                              {item.foodGroup && (
                                <span className="nutrition-inline-group">
                                  · {item.foodGroup}
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              maxLength={150}
                              aria-label={isRecipe ? 'Receta' : 'Alimento'}
                              disabled={disabled}
                              value={item.name}
                              aria-invalid={
                                isShown(nameKey, itemErr?.name)
                                  ? 'true'
                                  : 'false'
                              }
                              aria-describedby={
                                isShown(nameKey, itemErr?.name)
                                  ? `item-name-err-${item.id}`
                                  : undefined
                              }
                              onBlur={() => markTouched(nameKey)}
                              onChange={(e) =>
                                updateItem(meal.id, item.id, (i) => ({
                                  ...i,
                                  name: e.target.value,
                                }))
                              }
                              placeholder={
                                isRecipe
                                  ? 'Ej. Hotcakes de avena'
                                  : 'Ej. Pechuga de pollo'
                              }
                            />
                            {isShown(nameKey, itemErr?.name) && (
                              <span
                                id={`item-name-err-${item.id}`}
                                className="nutrition-field-error"
                              >
                                Error: {itemErr?.name}
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
                              aria-label={`Cantidad de ${item.name || (isRecipe ? 'receta' : 'alimento')}`}
                              disabled={disabled}
                              value={item.quantity === 0 ? '' : item.quantity}
                              aria-invalid={
                                isShown(qtyKey, itemErr?.quantity)
                                  ? 'true'
                                  : 'false'
                              }
                              aria-describedby={
                                isShown(qtyKey, itemErr?.quantity)
                                  ? `item-qty-err-${item.id}`
                                  : undefined
                              }
                              onBlur={() => markTouched(qtyKey)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed =
                                  raw.trim() === '' ? 0 : Number(raw);
                                const nextQty = Number.isFinite(parsed)
                                  ? parsed
                                  : 0;
                                updateItem(meal.id, item.id, (i) => {
                                  const catalogMatch = findCatalogMatch(i);
                                  if (!catalogMatch) {
                                    const nextIngredients =
                                      i.kind === 'recipe' &&
                                      i.recipeIngredients?.length &&
                                      i.quantity > 0 &&
                                      nextQty > 0
                                        ? scaleCustomRecipeIngredients(
                                            i.recipeIngredients,
                                            i.quantity,
                                            nextQty
                                          )
                                        : i.recipeIngredients;
                                    return {
                                      ...i,
                                      quantity: nextQty,
                                      recipeIngredients: nextIngredients,
                                    };
                                  }
                                  const scaled = calculateFoodMacros(
                                    catalogMatch,
                                    nextQty
                                  );
                                  const nextIngredients =
                                    i.kind === 'recipe' &&
                                    catalogMatch.own?.kind === 'recipe'
                                      ? nextQty > 0
                                        ? scaleRecipeIngredients(
                                            catalogMatch,
                                            nextQty
                                          )
                                        : i.recipeIngredients
                                      : i.recipeIngredients;
                                  return {
                                    ...i,
                                    quantity: nextQty,
                                    recipeIngredients: nextIngredients,
                                    calories:
                                      nextQty > 0 ? scaled.calories : null,
                                    proteinG:
                                      nextQty > 0 ? scaled.proteinG : null,
                                    carbsG: nextQty > 0 ? scaled.carbsG : null,
                                    fatG: nextQty > 0 ? scaled.fatG : null,
                                  };
                                });
                              }}
                              placeholder={isRecipe ? '1' : '150'}
                            />
                            {isShown(qtyKey, itemErr?.quantity) && (
                              <span
                                id={`item-qty-err-${item.id}`}
                                className="nutrition-field-error"
                              >
                                Error: {itemErr?.quantity}
                              </span>
                            )}
                          </div>

                          <div className="nutrition-item-cell">
                            <label>Unidad *</label>
                            <input
                              type="text"
                              list="nutrition-common-units"
                              aria-label={`Unidad de ${item.name || (isRecipe ? 'receta' : 'alimento')}`}
                              maxLength={50}
                              disabled={disabled}
                              value={item.unit}
                              aria-invalid={
                                isShown(unitKey, itemErr?.unit)
                                  ? 'true'
                                  : 'false'
                              }
                              aria-describedby={
                                isShown(unitKey, itemErr?.unit)
                                  ? `item-unit-err-${item.id}`
                                  : undefined
                              }
                              onBlur={() => markTouched(unitKey)}
                              onChange={(e) =>
                                updateItem(meal.id, item.id, (i) => ({
                                  ...i,
                                  unit: e.target.value,
                                }))
                              }
                              placeholder={isRecipe ? 'porción' : 'g, ml, pza'}
                            />
                            {isShown(unitKey, itemErr?.unit) && (
                              <span
                                id={`item-unit-err-${item.id}`}
                                className="nutrition-field-error"
                              >
                                Error: {itemErr?.unit}
                              </span>
                            )}
                          </div>

                          <div className="nutrition-item-actions">
                            <button
                              type="button"
                              className="ws-plain training-icon-btn"
                              aria-label="Subir elemento"
                              title="Subir"
                              disabled={disabled || itemIndex === 0}
                              onClick={() =>
                                updateMeal(meal.id, (m) => ({
                                  ...m,
                                  items: moveInArray(m.items, itemIndex, -1),
                                }))
                              }
                            >
                              <Icon name="chevron-up" size={14} />
                            </button>
                            <button
                              type="button"
                              className="ws-plain training-icon-btn"
                              aria-label="Bajar elemento"
                              title="Bajar"
                              disabled={
                                disabled || itemIndex === meal.items.length - 1
                              }
                              onClick={() =>
                                updateMeal(meal.id, (m) => ({
                                  ...m,
                                  items: moveInArray(m.items, itemIndex, 1),
                                }))
                              }
                            >
                              <Icon name="chevron-down" size={14} />
                            </button>
                            <button
                              type="button"
                              className="ws-plain training-icon-btn"
                              data-danger
                              aria-label={
                                isRecipe
                                  ? 'Eliminar receta'
                                  : 'Eliminar alimento'
                              }
                              title={
                                isRecipe
                                  ? 'Eliminar receta'
                                  : 'Eliminar alimento'
                              }
                              disabled={disabled}
                              onClick={() =>
                                updateMeal(meal.id, (m) => ({
                                  ...m,
                                  items: m.items.filter(
                                    (x) => x.id !== item.id
                                  ),
                                }))
                              }
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        </div>

                        <details className="nutrition-item-more">
                          <summary>
                            {item.calories != null
                              ? `${Math.round(item.calories)} kcal · P ${item.proteinG ?? 0} · C ${item.carbsG ?? 0} · G ${item.fatG ?? 0}`
                              : 'Sin macros de referencia'}
                            {isRecipe ? (
                              <span className="nutrition-item-more-hint">
                                {ingredientCount > 0
                                  ? `${ingredientCount} ${ingredientCount === 1 ? 'ingrediente' : 'ingredientes'} · Ver ingredientes y preparación`
                                  : 'Agregar ingredientes y pasos de preparación'}
                              </span>
                            ) : (
                              (item.instructions || item.substitutes) && (
                                <span className="nutrition-item-more-hint">
                                  {[
                                    item.instructions,
                                    item.substitutes &&
                                      `Sustituto: ${item.substitutes}`,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )
                            )}
                          </summary>
                          <div className="nutrition-item-more-body">
                            <div className="nutrition-item-kind-row">
                              <span className="nutrition-item-kind-label">
                                Tipo:
                              </span>
                              <div
                                className="ws-segmented m-0!"
                                role="group"
                                aria-label={`Tipo de ${item.name || 'elemento'}`}
                              >
                                <button
                                  type="button"
                                  className="ws-plain"
                                  disabled={disabled}
                                  aria-pressed={!isRecipe}
                                  onClick={() =>
                                    updateItem(meal.id, item.id, (i) => ({
                                      ...i,
                                      kind: 'food',
                                      recipeIngredients: null,
                                    }))
                                  }
                                >
                                  Alimento
                                </button>
                                <button
                                  type="button"
                                  className="ws-plain"
                                  disabled={disabled}
                                  aria-pressed={isRecipe}
                                  onClick={() =>
                                    updateItem(meal.id, item.id, (i) => ({
                                      ...i,
                                      kind: 'recipe',
                                      recipeIngredients:
                                        i.recipeIngredients ?? [],
                                    }))
                                  }
                                >
                                  Receta
                                </button>
                              </div>
                              <span className="nutrition-item-kind-hint">
                                {isRecipe
                                  ? 'Lleva ingredientes y pasos al móvil.'
                                  : 'Producto o ingrediente directo.'}
                              </span>
                            </div>

                            {isRecipe && (
                              <div className="nutrition-recipe-ingredients-editor">
                                <div className="nutrition-recipe-ingredients-head">
                                  <strong>
                                    Ingredientes para esta porción (
                                    {item.quantity > 0 ? item.quantity : 1}{' '}
                                    {item.unit || 'porción'})
                                  </strong>
                                  <button
                                    type="button"
                                    className="ws-btn"
                                    disabled={disabled || ingredientCount >= 40}
                                    onClick={() =>
                                      updateItem(meal.id, item.id, (i) => ({
                                        ...i,
                                        recipeIngredients: [
                                          ...(i.recipeIngredients ?? []),
                                          { name: '', quantity: 50, unit: 'g' },
                                        ],
                                      }))
                                    }
                                  >
                                    + Agregar ingrediente
                                  </button>
                                </div>
                                {ingredientCount === 0 ? (
                                  <p className="text-xs text-(--ws-muted)">
                                    Agrega los ingredientes que necesita tu
                                    cliente para preparar esta porción.
                                  </p>
                                ) : (
                                  <div className="nutrition-recipe-ingredient-rows">
                                    {(item.recipeIngredients ?? []).map(
                                      (ing, ingIndex) => (
                                        <div
                                          key={`${item.id}-ing-${ingIndex}`}
                                          className="nutrition-recipe-ingredient-row"
                                        >
                                          <input
                                            type="text"
                                            maxLength={150}
                                            disabled={disabled}
                                            aria-label={`Ingrediente ${ingIndex + 1} de ${item.name || 'receta'}`}
                                            value={ing.name}
                                            placeholder="Ej. Avena en hojuelas"
                                            onChange={(e) =>
                                              updateItem(
                                                meal.id,
                                                item.id,
                                                (i) => ({
                                                  ...i,
                                                  recipeIngredients: (
                                                    i.recipeIngredients ?? []
                                                  ).map((entry, idx) =>
                                                    idx === ingIndex
                                                      ? {
                                                          ...entry,
                                                          name: e.target.value,
                                                        }
                                                      : entry
                                                  ),
                                                })
                                              )
                                            }
                                          />
                                          <input
                                            type="number"
                                            min={0.1}
                                            max={10000}
                                            step={0.1}
                                            disabled={disabled}
                                            aria-label={`Cantidad del ingrediente ${ing.name || ingIndex + 1}`}
                                            value={
                                              ing.quantity === 0
                                                ? ''
                                                : ing.quantity
                                            }
                                            onChange={(e) => {
                                              const parsed = Number(
                                                e.target.value
                                              );
                                              updateItem(
                                                meal.id,
                                                item.id,
                                                (i) => ({
                                                  ...i,
                                                  recipeIngredients: (
                                                    i.recipeIngredients ?? []
                                                  ).map((entry, idx) =>
                                                    idx === ingIndex
                                                      ? {
                                                          ...entry,
                                                          quantity:
                                                            Number.isFinite(
                                                              parsed
                                                            )
                                                              ? parsed
                                                              : 0,
                                                        }
                                                      : entry
                                                  ),
                                                })
                                              );
                                            }}
                                          />
                                          <input
                                            type="text"
                                            list="nutrition-common-units"
                                            maxLength={50}
                                            disabled={disabled}
                                            aria-label={`Unidad del ingrediente ${ing.name || ingIndex + 1}`}
                                            value={ing.unit}
                                            onChange={(e) =>
                                              updateItem(
                                                meal.id,
                                                item.id,
                                                (i) => ({
                                                  ...i,
                                                  recipeIngredients: (
                                                    i.recipeIngredients ?? []
                                                  ).map((entry, idx) =>
                                                    idx === ingIndex
                                                      ? {
                                                          ...entry,
                                                          unit: e.target.value,
                                                        }
                                                      : entry
                                                  ),
                                                })
                                              )
                                            }
                                          />
                                          <button
                                            type="button"
                                            className="ws-plain training-icon-btn"
                                            data-danger
                                            disabled={disabled}
                                            aria-label={`Quitar ingrediente ${ing.name || ingIndex + 1}`}
                                            onClick={() =>
                                              updateItem(
                                                meal.id,
                                                item.id,
                                                (i) => ({
                                                  ...i,
                                                  recipeIngredients: (
                                                    i.recipeIngredients ?? []
                                                  ).filter(
                                                    (_, idx) => idx !== ingIndex
                                                  ),
                                                })
                                              )
                                            }
                                          >
                                            <Icon name="trash" size={14} />
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                                <small className="text-xs text-(--ws-muted)">
                                  Tu cliente verá exactamente estas cantidades
                                  en su app móvil.
                                </small>
                                {itemErr?.recipeIngredients &&
                                  showAllErrors && (
                                    <span className="nutrition-field-error">
                                      Error: {itemErr.recipeIngredients}
                                    </span>
                                  )}
                              </div>
                            )}

                            <div className="nutrition-item-extras">
                              <div className="nutrition-item-cell">
                                <label>
                                  {isRecipe
                                    ? 'Pasos de preparación (opcional)'
                                    : 'Preparación o nota (opcional)'}
                                </label>
                                {isRecipe ? (
                                  <textarea
                                    rows={3}
                                    maxLength={2000}
                                    disabled={disabled}
                                    value={item.instructions ?? ''}
                                    onChange={(e) =>
                                      updateItem(meal.id, item.id, (i) => ({
                                        ...i,
                                        instructions: e.target.value.trim()
                                          ? e.target.value
                                          : null,
                                      }))
                                    }
                                    placeholder="1. Mezcla los ingredientes…&#10;2. Cocina a fuego medio…"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    maxLength={2000}
                                    disabled={disabled}
                                    value={item.instructions ?? ''}
                                    onChange={(e) =>
                                      updateItem(meal.id, item.id, (i) => ({
                                        ...i,
                                        instructions: e.target.value.trim()
                                          ? e.target.value
                                          : null,
                                      }))
                                    }
                                    placeholder="En crudo, cocido, sin aceite..."
                                  />
                                )}
                              </div>

                              <div className="nutrition-item-cell">
                                <label>
                                  Equivalente / sustituto (opcional)
                                </label>
                                <input
                                  type="text"
                                  maxLength={500}
                                  disabled={disabled}
                                  value={item.substitutes ?? ''}
                                  onChange={(e) =>
                                    updateItem(meal.id, item.id, (i) => ({
                                      ...i,
                                      substitutes: e.target.value.trim()
                                        ? e.target.value
                                        : null,
                                    }))
                                  }
                                  placeholder="Ej. Pavo, pescado blanco o tofu"
                                />
                              </div>
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ))}

            {!mealCollapsed &&
              meal.items.length > 0 &&
              meal.items.length < 30 && (
                <div className="training-actions">
                  {guide && (
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={disabled}
                      onClick={() => void fillMeal(meal)}
                    >
                      <Icon name="sparkle" size={14} /> Volver a sugerir
                    </button>
                  )}
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={disabled}
                    onClick={() => setPickerMealId(meal.id)}
                  >
                    <Icon name="plus" size={14} /> Elegir alimento o receta
                  </button>
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={disabled}
                    onClick={() =>
                      updateMeal(meal.id, (m) => ({
                        ...m,
                        items: [...m.items, emptyItem('food')],
                      }))
                    }
                  >
                    + Alimento libre
                  </button>
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={disabled}
                    onClick={() =>
                      updateMeal(meal.id, (m) => ({
                        ...m,
                        items: [...m.items, emptyItem('recipe')],
                      }))
                    }
                  >
                    + Receta libre
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

      {pickerMeal && (
        <FoodPickerModal
          mealName={pickerMeal.name}
          onAddItem={(item) =>
            updateMeal(pickerMeal.id, (m) => ({
              ...m,
              items: [...m.items, item],
            }))
          }
          onAddManual={() =>
            updateMeal(pickerMeal.id, (m) => ({
              ...m,
              items: [...m.items, emptyItem('food')],
            }))
          }
          onAddManualRecipe={() =>
            updateMeal(pickerMeal.id, (m) => ({
              ...m,
              items: [...m.items, emptyItem('recipe')],
            }))
          }
          onClose={() => setPickerMealId(null)}
        />
      )}
    </div>
  );
}
