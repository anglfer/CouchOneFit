import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon';
import Modal from '../../training/components/Modal';
import type { NutritionItem } from '../types/nutrition';
import {
  FOOD_GROUPS,
  allFoods,
  calculateFoodMacros,
  createItemFromCatalogFood,
  findFoods,
  type CatalogFood,
  type FoodGroup,
} from '../utils/foodCatalog';

interface FoodPickerModalProps {
  mealName: string;
  allowRecipes?: boolean;
  onAddItem: (item: NutritionItem) => void;
  onAddManual: () => void;
  onAddManualRecipe?: () => void;
  onClose: () => void;
}

export default function FoodPickerModal({
  mealName,
  allowRecipes = true,
  onAddItem,
  onAddManual,
  onAddManualRecipe,
  onClose,
}: FoodPickerModalProps) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'food' | 'recipe'>(
    'all'
  );
  const [group, setGroup] = useState<FoodGroup | '' | 'own_food'>('');
  const availableFoods = allowRecipes
    ? allFoods()
    : allFoods().filter((food) => food.own?.kind !== 'recipe');
  const recipeCount = allowRecipes
    ? availableFoods.filter((food) => food.own?.kind === 'recipe').length
    : 0;
  const foodCount = availableFoods.length - recipeCount;
  const ownFoodCount = availableFoods.filter(
    (food) => food.own?.kind === 'food'
  ).length;
  const [addedCounts, setAddedCounts] = useState<Record<string, number>>({});

  const results = findFoods(
    query,
    group && group !== 'own_food' ? group : undefined
  ).filter((food) => {
    const isRecipe = food.own?.kind === 'recipe';
    if (!allowRecipes && isRecipe) return false;
    if (kindFilter === 'food' && isRecipe) return false;
    if (kindFilter === 'recipe' && !isRecipe) return false;
    if (group === 'own_food') return food.own?.kind === 'food';
    return true;
  });

  const totalAdded = useMemo(
    () => Object.values(addedCounts).reduce((sum, count) => sum + count, 0),
    [addedCounts]
  );

  const handleSelect = (food: CatalogFood) => {
    onAddItem(createItemFromCatalogFood(food));
    setAddedCounts((prev) => ({
      ...prev,
      [food.id]: (prev[food.id] ?? 0) + 1,
    }));
  };

  return (
    <Modal
      wide
      title={
        allowRecipes
          ? `Elegir alimentos o recetas para ${mealName || 'la comida'}`
          : `Elegir ingredientes para ${mealName || 'la receta'}`
      }
      subtitle={
        allowRecipes
          ? 'Prescribe alimentos individuales o recetas completas. Las recetas llevan sus ingredientes y preparación a la app del cliente.'
          : 'Selecciona alimentos individuales del catálogo o de tu biblioteca para armar la receta.'
      }
      onClose={onClose}
    >
      <div className="nutrition-picker-controls">
        {allowRecipes && (
          <div className="nutrition-picker-kind-bar">
            <div
              className="ws-segmented m-0!"
              role="group"
              aria-label="Filtrar por tipo"
            >
              {(
                [
                  ['all', `Todos (${availableFoods.length})`],
                  ['food', `Alimentos (${foodCount})`],
                  ['recipe', `Recetas (${recipeCount})`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="ws-plain"
                  aria-pressed={kindFilter === value}
                  onClick={() => {
                    setKindFilter(value);
                    if (value === 'recipe' && group === 'own_food') {
                      setGroup('');
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="nutrition-picker-search">
          <span className="sr-only">
            {allowRecipes ? 'Buscar alimento o receta' : 'Buscar ingrediente'}
          </span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              allowRecipes
                ? 'Buscar pollo, avena, hotcakes, elote, yogur…'
                : 'Buscar pollo, avena, elote, yogur, aguacate…'
            }
          />
        </label>

        <div
          className="nutrition-group-pills"
          role="group"
          aria-label="Filtrar por grupo"
        >
          <button
            type="button"
            className="ws-plain nutrition-group-pill"
            aria-pressed={group === ''}
            onClick={() => setGroup('')}
          >
            Todos los grupos
          </button>
          {kindFilter !== 'recipe' && ownFoodCount > 0 && (
            <button
              type="button"
              className="ws-plain nutrition-group-pill"
              aria-pressed={group === 'own_food'}
              onClick={() => setGroup(group === 'own_food' ? '' : 'own_food')}
            >
              Mis alimentos ({ownFoodCount})
            </button>
          )}
          {FOOD_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className="ws-plain nutrition-group-pill"
              aria-pressed={group === g}
              onClick={() => setGroup(group === g ? '' : g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        kindFilter === 'recipe' && recipeCount === 0 && !query.trim() ? (
          <div className="ws-empty nutrition-picker-empty">
            <p>Aún no tienes recetas guardadas en tu biblioteca.</p>
            <p className="text-xs text-(--ws-muted)">
              Puedes agregar una receta libre solo para esta comida o crear
              recetas reutilizables en la sección Alimentos.
            </p>
            {onAddManualRecipe && (
              <button
                type="button"
                className="ws-btn"
                data-variant="primary"
                onClick={() => {
                  onAddManualRecipe();
                  onClose();
                }}
              >
                <Icon name="bowl" size={14} /> Agregar receta libre a esta
                comida
              </button>
            )}
          </div>
        ) : (
          <div className="ws-empty nutrition-picker-empty">
            <p>No encontramos coincidencias para esa búsqueda.</p>
            <button
              type="button"
              className="ws-btn"
              onClick={() => {
                if (kindFilter === 'recipe' && onAddManualRecipe) {
                  onAddManualRecipe();
                } else {
                  onAddManual();
                }
                onClose();
              }}
            >
              {!allowRecipes
                ? 'Agregar ingrediente manual'
                : kindFilter === 'recipe' && onAddManualRecipe
                  ? 'Agregar receta libre'
                  : 'Agregar alimento libre con ese nombre'}
            </button>
          </div>
        )
      ) : (
        <div className="nutrition-food-grid">
          {results.map((food) => {
            const macros = calculateFoodMacros(food, food.defaultQuantity);
            const count = addedCounts[food.id] ?? 0;
            const isRecipe = food.own?.kind === 'recipe';
            const ingredientCount = food.own?.ingredients?.length ?? 0;
            const ingredientPreview = (food.own?.ingredients ?? [])
              .slice(0, 3)
              .map((ing) => ing.name)
              .join(', ');
            return (
              <button
                key={food.id}
                type="button"
                className="ws-plain nutrition-food-card"
                data-kind={isRecipe ? 'recipe' : 'food'}
                data-added={count > 0 || undefined}
                onClick={() => handleSelect(food)}
              >
                <div className="nutrition-food-card-top">
                  <span
                    className="nutrition-kind-badge"
                    data-kind={isRecipe ? 'recipe' : 'food'}
                  >
                    {isRecipe && <Icon name="bowl" size={11} />}
                    {isRecipe ? 'Receta' : 'Alimento'}
                  </span>
                  <span className="nutrition-food-portion">
                    {food.defaultQuantity} {food.defaultUnit}
                  </span>
                </div>
                <strong>{food.name}</strong>
                <small className="nutrition-food-ingredients-preview">
                  {isRecipe ? (
                    <>
                      {food.group}
                      {ingredientCount > 0
                        ? ` · ${ingredientCount} ${ingredientCount === 1 ? 'ingrediente' : 'ingredientes'}${ingredientPreview ? `: ${ingredientPreview}${ingredientCount > 3 ? '…' : ''}` : ''}`
                        : ''}
                      {food.preparationHint.trim() ? ' · Con preparación' : ''}
                    </>
                  ) : food.own ? (
                    `Mi biblioteca · ${food.group}`
                  ) : (
                    food.group
                  )}
                </small>
                <small className="nutrition-food-macros">
                  {macros.calories} kcal · P {macros.proteinG}g · C{' '}
                  {macros.carbsG}g · G {macros.fatG}g
                </small>
                {food.defaultSubstitutes && (
                  <small className="nutrition-food-subs">
                    Eq: {food.defaultSubstitutes}
                  </small>
                )}
                <span className="nutrition-food-add-label">
                  {count > 0
                    ? `✓ Añadido${count > 1 ? ` ×${count}` : ''}`
                    : '+ Añadir'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <footer className="nutrition-picker-foot">
        <div className="nutrition-picker-foot-actions">
          <button
            type="button"
            className="ws-btn"
            onClick={() => {
              onAddManual();
              onClose();
            }}
          >
            {allowRecipes
              ? 'Agregar alimento libre'
              : 'Agregar ingrediente manual'}
          </button>
          {allowRecipes && onAddManualRecipe && (
            <button
              type="button"
              className="ws-btn"
              onClick={() => {
                onAddManualRecipe();
                onClose();
              }}
            >
              <Icon name="bowl" size={14} /> Agregar receta libre
            </button>
          )}
        </div>
        <button
          type="button"
          className="ws-btn"
          data-variant="primary"
          onClick={onClose}
        >
          Listo{totalAdded > 0 ? ` (${totalAdded})` : ''}
        </button>
      </footer>
    </Modal>
  );
}
