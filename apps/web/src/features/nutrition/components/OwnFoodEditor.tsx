import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import { guardNavigation } from '../../../utils/navigation';
import { createOwnFood, updateOwnFood } from '../services/foodLibrary';
import type { OwnFood } from '../types/foodLibrary';
import {
  COMMON_UNITS,
  FOOD_GROUPS,
  FOOD_RESTRICTIONS,
  MEAL_CATEGORY_OPTIONS,
  type FoodGroup,
} from '../utils/foodCatalog';
import {
  MACROS,
  parse,
  perPortion,
  round1,
  row,
  toInput,
  type FoodDraft,
  type Row,
} from '../utils/foodDraft';
import FoodPickerModal from './FoodPickerModal';
import '../../training/training.css';

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const confirmDiscard = () =>
  confirmDialog({
    title: '¿Descartar los cambios sin guardar?',
    message: 'Si sales ahora, se perderán los cambios de este alimento.',
    confirmLabel: 'Descartar cambios',
    cancelLabel: 'Seguir editando',
    danger: true,
  });

export default function OwnFoodEditor({
  food,
  initial,
  onClose,
  onSaved,
}: {
  food: OwnFood | null;
  initial: FoodDraft;
  onClose: () => void;
  onSaved: (saved: OwnFood) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [picking, setPicking] = useState(false);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  );
  const set = (patch: Partial<FoodDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const recipe = draft.kind === 'recipe';
  const portion = recipe ? perPortion(draft) : null;

  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const release = guardNavigation(confirmDiscard);
    window.addEventListener('beforeunload', warn);
    return () => {
      release();
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty, busy]);

  async function save() {
    const input = toInput(draft);
    if (typeof input === 'string') {
      setError(input);
      return;
    }
    setBusy(true);
    setError('');
    setNameError('');
    try {
      onSaved(
        food ? await updateOwnFood(food, input) : await createOwnFood(input)
      );
    } catch (failure) {
      setBusy(false);
      if (failure instanceof ApiError && failure.fields.name)
        setNameError(failure.fields.name);
      setError(
        failure instanceof Error && failure.message
          ? failure.message
          : 'No pudimos guardar el alimento. Revisa tu conexión e inténtalo de nuevo.'
      );
    }
  }

  // Functional update: the picker can add several ingredients before re-rendering.
  const addRow = (next: Row) =>
    setDraft((current) => ({
      ...current,
      ingredients: [...current.ingredients, next],
    }));

  function updateRow(key: string, patch: (r: Row) => Partial<Row>) {
    set({
      ingredients: draft.ingredients.map((r) =>
        r.key === key ? { ...r, ...patch(r) } : r
      ),
    });
  }

  function changeQuantity(r: Row, text: string) {
    const next = parse(text);
    // Macros are linear in quantity: rescale from the last valid amount.
    if (!(next > 0)) return { quantityText: text };
    const factor = next / r.quantity;
    return {
      quantityText: text,
      quantity: next,
      calories: r.calories * factor,
      proteinG: r.proteinG * factor,
      carbsG: r.carbsG * factor,
      fatG: r.fatG * factor,
    };
  }

  const estimated =
    4 * parse(draft.proteinG) + 4 * parse(draft.carbsG) + 9 * parse(draft.fatG);
  const kcal = parse(draft.calories);
  const offEstimate =
    Number.isFinite(estimated) &&
    estimated > 0 &&
    !(Math.abs(kcal - estimated) <= Math.max(5, estimated * 0.05));
  const referenceLabel =
    draft.basis === 'per_100'
      ? `Valores por 100 ${draft.defaultUnit === 'ml' ? 'ml' : 'g'}`
      : `Valores por 1 ${draft.defaultUnit || 'pieza'}`;

  return (
    <form
      className="training-editing"
      aria-label={food ? `Editar ${food.name}` : 'Nuevo alimento'}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="training-savebar">
        <button
          type="button"
          className="ws-btn"
          onClick={() => {
            void (async () => {
              if (!dirty || (await confirmDiscard())) onClose();
            })();
          }}
        >
          <Icon name="arrow-right" size={16} className="rotate-180" /> Alimentos
        </button>
        <div className="training-savebar-status">
          <strong>
            {draft.name.trim() ||
              (recipe ? 'Receta sin nombre' : 'Alimento sin nombre')}
          </strong>
          <small>
            {busy
              ? 'Guardando…'
              : dirty
                ? 'Cambios sin guardar'
                : food
                  ? 'Todo guardado'
                  : 'Aún no se guarda'}
          </small>
        </div>
        <button
          className="ws-btn"
          data-variant="primary"
          disabled={busy || (!!food && !dirty)}
        >
          {food ? 'Guardar cambios' : 'Guardar en mi biblioteca'}
        </button>
      </div>

      {error && (
        <div role="alert" className="ws-alert" data-tone="bad">
          {error}
        </div>
      )}

      <section className="ws-card space-y-4" aria-labelledby="food-basics">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="food-basics" className="ws-card-title">
            Datos generales
          </h2>
          <div className="ws-segmented m-0!" role="group" aria-label="Tipo">
            {(
              [
                ['food', 'Alimento'],
                ['recipe', 'Receta'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="ws-plain"
                aria-pressed={draft.kind === kind}
                onClick={() => set({ kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            Nombre
            <input
              className="block w-full"
              required
              maxLength={120}
              value={draft.name}
              aria-invalid={!!nameError || undefined}
              aria-describedby={nameError ? 'food-name-error' : undefined}
              placeholder={
                recipe ? 'Hotcakes de avena' : 'Tortilla de nopal marca X'
              }
              onChange={(e) => {
                setNameError('');
                set({ name: e.target.value });
              }}
            />
            {nameError && (
              <p
                id="food-name-error"
                className="mt-1 font-normal text-(--ws-bad-fg)"
              >
                {nameError}
              </p>
            )}
          </label>
          <label className="block">
            Grupo
            <select
              className="block w-full"
              value={draft.group}
              onChange={(e) => set({ group: e.target.value as FoodGroup })}
            >
              {FOOD_GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {recipe ? (
        <section
          className="ws-card space-y-4"
          aria-labelledby="recipe-ingredients"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="recipe-ingredients" className="ws-card-title">
                Ingredientes
              </h2>
              <p className="text-sm text-(--ws-muted)">
                Captura la receta completa; los macros por porción se calculan
                solos.
              </p>
            </div>
            <div className="training-actions">
              <button
                type="button"
                className="ws-btn"
                onClick={() => setPicking(true)}
              >
                <Icon name="plus" size={16} /> Agregar ingredientes
              </button>
            </div>
          </div>
          {draft.ingredients.length > 0 && (
            <div className="relative overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Ingrediente</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col" className="text-right!">
                      kcal
                    </th>
                    <th scope="col" className="text-right!">
                      Prot.
                    </th>
                    <th scope="col" className="text-right!">
                      Carb.
                    </th>
                    <th scope="col" className="text-right!">
                      Grasa
                    </th>
                    <th scope="col">
                      <span className="sr-only">Quitar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.ingredients.map((r) => (
                    <tr key={r.key}>
                      <td>
                        {r.manual ? (
                          <input
                            aria-label="Nombre del ingrediente"
                            maxLength={150}
                            value={r.name}
                            onChange={(e) =>
                              updateRow(r.key, () => ({ name: e.target.value }))
                            }
                          />
                        ) : (
                          r.name
                        )}
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <input
                            className="w-20"
                            inputMode="decimal"
                            aria-label={`Cantidad de ${r.name || 'ingrediente'}`}
                            value={r.quantityText}
                            onChange={(e) =>
                              updateRow(r.key, (cur) =>
                                changeQuantity(cur, e.target.value)
                              )
                            }
                          />
                          {r.manual ? (
                            <input
                              className="w-20"
                              aria-label="Unidad"
                              list="food-units"
                              maxLength={50}
                              value={r.unit}
                              onChange={(e) =>
                                updateRow(r.key, () => ({
                                  unit: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <span className="text-(--ws-muted)">{r.unit}</span>
                          )}
                        </span>
                      </td>
                      {MACROS.map(([m, label]) => (
                        <td key={m} className="text-right tabular-nums">
                          {r.manual ? (
                            <input
                              // Remount on quantity change so the scaled value shows.
                              key={`${m}-${r.quantity}`}
                              className="w-20 text-right"
                              inputMode="decimal"
                              aria-label={`${label} de ${r.name || 'ingrediente'}`}
                              defaultValue={round1(r[m])}
                              onChange={(e) => {
                                const v = parse(e.target.value);
                                if (v >= 0)
                                  updateRow(r.key, () => ({ [m]: v }));
                              }}
                            />
                          ) : (
                            round1(r[m])
                          )}
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="ws-btn ws-plain"
                          aria-label={`Quitar ${r.name || 'ingrediente'}`}
                          onClick={() =>
                            set({
                              ingredients: draft.ingredients.filter(
                                (x) => x.key !== r.key
                              ),
                            })
                          }
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid items-end gap-4 sm:grid-cols-[160px_1fr]">
            <label className="block">
              Rinde (porciones)
              <input
                className="block w-full"
                inputMode="numeric"
                value={draft.servings}
                onChange={(e) => set({ servings: e.target.value })}
              />
            </label>
            <p
              className="rounded-lg bg-(--ws-surface-2) px-4 py-3 text-sm"
              aria-live="polite"
            >
              {portion && draft.ingredients.length > 0 ? (
                <>
                  Por porción: <strong>{portion.calories} kcal</strong> · P{' '}
                  {portion.proteinG} g · C {portion.carbsG} g · G {portion.fatG}{' '}
                  g
                </>
              ) : (
                'Agrega ingredientes y porciones para ver los macros por porción.'
              )}
            </p>
          </div>
        </section>
      ) : (
        <section className="ws-card space-y-4" aria-labelledby="food-values">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="food-values" className="ws-card-title">
              Valores nutrimentales
            </h2>
            <div
              className="ws-segmented m-0!"
              role="group"
              aria-label="Los valores son"
            >
              <button
                type="button"
                className="ws-plain"
                aria-pressed={draft.basis === 'per_100'}
                onClick={() =>
                  set({
                    basis: 'per_100',
                    defaultUnit: draft.defaultUnit === 'ml' ? 'ml' : 'g',
                    defaultQuantity: '100',
                  })
                }
              >
                Por 100 g o ml
              </button>
              <button
                type="button"
                className="ws-plain"
                aria-pressed={draft.basis === 'per_unit'}
                onClick={() =>
                  set({
                    basis: 'per_unit',
                    defaultUnit: 'pza',
                    defaultQuantity: '1',
                  })
                }
              >
                Por pieza o porción
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {MACROS.map(([m, label]) => (
              <label key={m} className="block">
                {label}
                <input
                  className="block w-full text-right tabular-nums"
                  inputMode="decimal"
                  value={draft[m]}
                  onChange={(e) => set({ [m]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-(--ws-muted)">
            {referenceLabel}.
            {offEstimate && (
              <>
                {' '}
                Con estos macros serían unas {Math.round(estimated)} kcal.{' '}
                <button
                  type="button"
                  className="ws-plain font-semibold text-(--ws-primary-fg) underline underline-offset-3"
                  onClick={() =>
                    set({ calories: String(Math.round(estimated)) })
                  }
                >
                  Usar {Math.round(estimated)} kcal
                </button>
              </>
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              Unidad
              {draft.basis === 'per_100' ? (
                <select
                  className="block w-full"
                  value={draft.defaultUnit}
                  onChange={(e) => set({ defaultUnit: e.target.value })}
                >
                  <option value="g">g (gramos)</option>
                  <option value="ml">ml (mililitros)</option>
                </select>
              ) : (
                <input
                  className="block w-full"
                  list="food-units"
                  maxLength={20}
                  value={draft.defaultUnit}
                  onChange={(e) => set({ defaultUnit: e.target.value })}
                />
              )}
            </label>
            <label className="block">
              Porción habitual ({draft.defaultUnit || 'unidad'})
              <input
                className="block w-full"
                inputMode="decimal"
                value={draft.defaultQuantity}
                onChange={(e) => set({ defaultQuantity: e.target.value })}
              />
              <small className="mt-1 block font-normal text-(--ws-muted)">
                Lo que se agrega al plan; si cambias la cantidad ahí, los macros
                se recalculan.
              </small>
            </label>
          </div>
        </section>
      )}

      <section className="ws-card space-y-4" aria-labelledby="food-notes">
        <h2 id="food-notes" className="ws-card-title">
          Preparación y equivalencias
        </h2>
        <label className="block">
          {recipe ? 'Preparación' : 'Preparación o forma de consumo'}
          <textarea
            className="block w-full"
            maxLength={2000}
            value={draft.preparation}
            placeholder={
              recipe
                ? 'Pasos, tiempo y método de cocción…'
                : 'A la plancha, cocido, sin aceite…'
            }
            onChange={(e) => set({ preparation: e.target.value })}
          />
        </label>
        <label className="block">
          Equivalencias
          <input
            className="block w-full"
            maxLength={300}
            value={draft.substitutes}
            placeholder="Con qué se puede sustituir"
            onChange={(e) => set({ substitutes: e.target.value })}
          />
        </label>
        <p className="text-xs text-(--ws-muted)">
          Se copian al plan junto con el alimento y el cliente las ve en su app.
        </p>
      </section>

      <section className="ws-card space-y-5" aria-labelledby="food-use">
        <h2 id="food-use" className="ws-card-title">
          Uso en sugerencias automáticas
        </h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-(--ws-text-2)">
            Apto para
          </legend>
          <p className="text-xs text-(--ws-muted)">
            Con una restricción activa, las sugerencias solo usan alimentos
            propios marcados como aptos.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOD_RESTRICTIONS.map(([code, label]) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={draft.suitableFor.includes(code)}
                  onChange={() =>
                    set({ suitableFor: toggle(draft.suitableFor, code) })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-(--ws-text-2)">
            Preferir en
          </legend>
          <p className="text-xs text-(--ws-muted)">
            En estos tiempos de comida, «Sugerir alimentos» lo usará en lugar
            del alimento base de su grupo
            {recipe ? ' (una receta ocupa el lugar de su macro principal)' : ''}
            .
          </p>
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
            {MEAL_CATEGORY_OPTIONS.filter(([c]) => c !== 'other').map(
              ([category, label]) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={draft.mealCategories.includes(category)}
                    onChange={() =>
                      set({
                        mealCategories: toggle(draft.mealCategories, category),
                      })
                    }
                  />
                  {label}
                </label>
              )
            )}
          </div>
        </fieldset>
      </section>

      <datalist id="food-units">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {picking && (
        <FoodPickerModal
          mealName="la receta"
          onAddItem={(item) =>
            addRow(
              row({
                name: item.name,
                unit: item.unit,
                quantity: item.quantity,
                calories: item.calories ?? 0,
                proteinG: item.proteinG ?? 0,
                carbsG: item.carbsG ?? 0,
                fatG: item.fatG ?? 0,
              })
            )
          }
          onAddManual={() =>
            addRow(
              row(
                {
                  name: '',
                  unit: 'g',
                  quantity: 100,
                  calories: 0,
                  proteinG: 0,
                  carbsG: 0,
                  fatG: 0,
                },
                true
              )
            )
          }
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  );
}
