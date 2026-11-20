import { useMemo, useState } from 'react';
import Modal from '../../training/components/Modal';
import type { NutritionItem } from '../types/nutrition';
import {
  FOOD_GROUPS,
  calculateFoodMacros,
  createItemFromCatalogFood,
  findFoods,
  type CatalogFood,
  type FoodGroup,
} from '../utils/foodCatalog';

interface FoodPickerModalProps {
  mealName: string;
  onAddItem: (item: NutritionItem) => void;
  onAddManual: () => void;
  onClose: () => void;
}

export default function FoodPickerModal({
  mealName,
  onAddItem,
  onAddManual,
  onClose,
}: FoodPickerModalProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<FoodGroup | ''>('');
  const [addedCounts, setAddedCounts] = useState<Record<string, number>>({});

  const results = useMemo(
    () => findFoods(query, group || undefined),
    [query, group]
  );

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
      title={`Elegir alimentos para ${mealName || 'la comida'}`}
      subtitle="Selecciona uno o varios alimentos de referencia con porciones, macros y equivalentes editables."
      onClose={onClose}
    >
      <div className="nutrition-picker-controls">
        <label className="nutrition-picker-search">
          <span className="sr-only">Buscar alimento</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pollo, avena, elote, yogur, aguacate…"
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
            Todos
          </button>
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
        <div className="ws-empty nutrition-picker-empty">
          <p>No encontramos coincidencias para esa búsqueda.</p>
          <button
            type="button"
            className="ws-btn"
            onClick={() => {
              onAddManual();
              onClose();
            }}
          >
            Agregar alimento libre con ese nombre
          </button>
        </div>
      ) : (
        <div className="nutrition-food-grid">
          {results.map((food) => {
            const macros = calculateFoodMacros(food, food.defaultQuantity);
            const count = addedCounts[food.id] ?? 0;
            return (
              <button
                key={food.id}
                type="button"
                className="ws-plain nutrition-food-card"
                data-added={count > 0 || undefined}
                onClick={() => handleSelect(food)}
              >
                <div className="nutrition-food-card-top">
                  <span className="nutrition-food-group-tag">{food.group}</span>
                  <span className="nutrition-food-portion">
                    {food.defaultQuantity} {food.defaultUnit}
                  </span>
                </div>
                <strong>{food.name}</strong>
                <small className="nutrition-food-macros">
                  {macros.calories} kcal · P {macros.proteinG}g · C{' '}
                  {macros.carbsG}g · G {macros.fatG}g
                </small>
                <small className="nutrition-food-subs">
                  Eq: {food.defaultSubstitutes}
                </small>
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
        <button
          type="button"
          className="ws-btn"
          onClick={() => {
            onAddManual();
            onClose();
          }}
        >
          Agregar alimento libre
        </button>
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
