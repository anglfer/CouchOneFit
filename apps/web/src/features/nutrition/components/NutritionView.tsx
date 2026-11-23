import { useState } from 'react';
import { Icon } from '../../../components/Icon';
import type {
  NutritionDocument,
  NutritionMealCategory,
} from '../types/nutrition';
import {
  formatMealItemsCount,
  summarizeDocumentMacros,
  summarizeItemsMacros,
} from '../utils/foodCatalog';
import MacroBar from './MacroBar';

const CATEGORY_LABELS: Record<NutritionMealCategory, string> = {
  breakfast: 'Desayuno',
  morning_snack: 'Colación',
  lunch: 'Comida',
  pre_workout: 'Pre-entreno',
  post_workout: 'Post-entreno',
  afternoon_snack: 'Merienda',
  dinner: 'Cena',
  pre_bed: 'Nocturna',
  other: 'Comida',
};

const formatQuantity = (qty: number) =>
  Number.isInteger(qty) ? qty.toString() : qty.toFixed(1).replace('.', ',');

export default function NutritionView({ plan }: { plan: NutritionDocument }) {
  const [dayMode, setDayMode] = useState<'training' | 'rest'>('training');
  const hasRest = Boolean(plan.restDayTargets);
  const showingRest = hasRest && dayMode === 'rest';

  const activeTargets = showingRest
    ? {
        caloriesTarget: plan.restDayTargets!.caloriesTarget,
        proteinTargetG: plan.restDayTargets!.proteinTargetG,
        carbsTargetG: plan.restDayTargets!.carbsTargetG,
        fatTargetG: plan.restDayTargets!.fatTargetG,
      }
    : {
        caloriesTarget: plan.caloriesTarget,
        proteinTargetG: plan.proteinTargetG,
        carbsTargetG: plan.carbsTargetG,
        fatTargetG: plan.fatTargetG,
      };

  const docSummary = summarizeDocumentMacros(plan);

  return (
    <div className="nutrition-view">
      {hasRest && (
        <div className="nutrition-view-day-bar">
          <div
            className="training-segmented"
            role="group"
            aria-label="Tipo de día"
          >
            <button
              type="button"
              className="ws-plain"
              aria-pressed={dayMode === 'training'}
              onClick={() => setDayMode('training')}
            >
              Día de entreno
            </button>
            <button
              type="button"
              className="ws-plain"
              aria-pressed={dayMode === 'rest'}
              onClick={() => setDayMode('rest')}
            >
              Día de descanso
            </button>
          </div>
          {plan.suggestionMeta && (
            <span className="nutrition-origin-pill">
              {plan.suggestionMeta.modifiedByProfessional
                ? 'Base del asistente · ajustada por ti'
                : 'Calculado con el asistente'}
            </span>
          )}
        </div>
      )}

      <MacroBar
        label={
          showingRest ? 'Objetivos en día de descanso' : 'Objetivos diarios'
        }
        caloriesTarget={activeTargets.caloriesTarget}
        proteinG={activeTargets.proteinTargetG}
        carbsG={activeTargets.carbsTargetG}
        fatG={activeTargets.fatTargetG}
        planned={showingRest ? null : docSummary}
      />

      {(plan.fiberTargetG != null || plan.hydrationTargetMl != null) && (
        <div className="nutrition-complement-strip">
          {plan.hydrationTargetMl != null && (
            <div className="nutrition-complement-item">
              <Icon name="droplet" size={16} />
              <div>
                <span>Hidratación</span>
                <strong>
                  {(plan.hydrationTargetMl / 1000).toFixed(1)} L / día
                </strong>
              </div>
            </div>
          )}
          {plan.fiberTargetG != null && (
            <div className="nutrition-complement-item">
              <Icon name="bowl" size={16} />
              <div>
                <span>Fibra sugerida</span>
                <strong>{plan.fiberTargetG} g / día</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {plan.periWorkout && (
        <section className="nutrition-peri-card">
          <div className="nutrition-peri-head">
            <Icon name="flame" size={16} />
            <strong>Guía peri-entreno</strong>
          </div>
          <div className="nutrition-peri-grid">
            <div>
              <span>Pre-entreno</span>
              <strong>
                P {plan.periWorkout.preProteinG}g · C{' '}
                {plan.periWorkout.preCarbsG}g · G {plan.periWorkout.preFatG}g
              </strong>
            </div>
            {plan.periWorkout.intraCarbsG > 0 && (
              <div>
                <span>Intra-entreno</span>
                <strong>C {plan.periWorkout.intraCarbsG}g líquidos</strong>
              </div>
            )}
            <div>
              <span>Post-entreno</span>
              <strong>
                P {plan.periWorkout.postProteinG}g · C{' '}
                {plan.periWorkout.postCarbsG}g · G {plan.periWorkout.postFatG}g
              </strong>
            </div>
          </div>
          {plan.periWorkout.notes && (
            <p className="training-muted">{plan.periWorkout.notes}</p>
          )}
        </section>
      )}

      {plan.generalInstructions && (
        <section className="nutrition-guidance-card">
          <strong className="text-sm font-semibold">
            Indicaciones generales
          </strong>
          <p>{plan.generalInstructions}</p>
        </section>
      )}

      {plan.meals.length === 0 ? (
        <p className="ws-empty">
          Este plan aún no tiene tiempos de comida registrados.
        </p>
      ) : (
        <div className="nutrition-view-meals">
          {plan.meals.map((meal, idx) => {
            const mealSummary = summarizeItemsMacros(meal.items);
            return (
              <article key={meal.id} className="nutrition-view-meal">
                <div className="nutrition-view-meal-head">
                  <div className="nutrition-view-meal-title">
                    <span className="training-order" aria-hidden="true">
                      {idx + 1}
                    </span>
                    <div>
                      <h3>{meal.name}</h3>
                      <div className="nutrition-view-meal-badges">
                        {meal.scheduleTime && (
                          <span className="nutrition-mini-badge">
                            <Icon name="clock" size={12} /> {meal.scheduleTime}
                          </span>
                        )}
                        {meal.category && (
                          <span className="nutrition-mini-badge">
                            {CATEGORY_LABELS[meal.category]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="nutrition-view-meal-right">
                    <small className="training-muted">
                      {formatMealItemsCount(meal.items)}
                    </small>
                    {mealSummary.itemsWithMacros > 0 && (
                      <small className="nutrition-meal-kcal">
                        {mealSummary.calories} kcal · P{' '}
                        {Math.round(mealSummary.proteinG)}g · C{' '}
                        {Math.round(mealSummary.carbsG)}g · G{' '}
                        {Math.round(mealSummary.fatG)}g
                      </small>
                    )}
                  </div>
                </div>

                {meal.instructions && (
                  <p className="training-muted">{meal.instructions}</p>
                )}

                {meal.items.length > 0 && (
                  <ul className="nutrition-view-items">
                    {meal.items.map((item) => {
                      const isRecipe = item.kind === 'recipe';
                      return (
                        <li
                          key={item.id}
                          data-kind={isRecipe ? 'recipe' : 'food'}
                        >
                          <div className="nutrition-view-item-body">
                            <div className="nutrition-view-item-title">
                              <span
                                className="nutrition-kind-badge"
                                data-kind={isRecipe ? 'recipe' : 'food'}
                              >
                                {isRecipe && <Icon name="bowl" size={11} />}
                                {isRecipe ? 'Receta' : 'Alimento'}
                              </span>
                              <strong>{item.name}</strong>
                              {item.foodGroup && (
                                <span className="nutrition-inline-group">
                                  {item.foodGroup}
                                </span>
                              )}
                            </div>
                            {isRecipe ? (
                              <div className="nutrition-view-recipe-box">
                                {item.recipeIngredients &&
                                  item.recipeIngredients.length > 0 && (
                                    <div className="nutrition-view-ingredients">
                                      <small className="nutrition-view-recipe-label">
                                        Ingredientes (
                                        {formatQuantity(item.quantity)}{' '}
                                        {item.unit})
                                      </small>
                                      <div className="nutrition-view-ingredient-list">
                                        {item.recipeIngredients.map(
                                          (ing, ingIdx) => (
                                            <span
                                              key={`${ing.name}-${ingIdx}`}
                                              className="nutrition-view-ingredient-chip"
                                            >
                                              {formatQuantity(ing.quantity)}{' '}
                                              {ing.unit} · {ing.name}
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                                {item.instructions && (
                                  <p className="nutrition-view-recipe-steps">
                                    <strong>Preparación:</strong>{' '}
                                    {item.instructions}
                                  </p>
                                )}
                              </div>
                            ) : (
                              item.instructions && (
                                <small className="training-muted">
                                  {item.instructions}
                                </small>
                              )
                            )}
                            {item.substitutes && (
                              <small className="nutrition-view-subs">
                                <Icon name="swap" size={12} /> Equivalente:{' '}
                                {item.substitutes}
                              </small>
                            )}
                          </div>
                          <div className="nutrition-view-item-qty">
                            <span className="nutrition-qty-pill">
                              {formatQuantity(item.quantity)} {item.unit}
                            </span>
                            {item.calories != null && (
                              <small className="nutrition-item-kcal">
                                {Math.round(item.calories)} kcal
                              </small>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
