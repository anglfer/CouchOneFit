import type { NutritionDocument } from '../types/nutrition';

export interface NutritionFieldErrors {
  name?: string;
  caloriesTarget?: string;
  proteinTargetG?: string;
  carbsTargetG?: string;
  fatTargetG?: string;
  mealsGeneral?: string;
  meals: Record<
    string,
    {
      name?: string;
      instructions?: string;
      itemsGeneral?: string;
      items: Record<
        string,
        {
          name?: string;
          quantity?: string;
          unit?: string;
          instructions?: string;
        }
      >;
    }
  >;
}

export interface NutritionValidationResult {
  valid: boolean;
  count: number;
  summary: string[];
  errors: NutritionFieldErrors;
}

const MACRO_LIMITS = {
  caloriesTarget: { label: 'Las calorías', min: 1, max: 15000, unit: 'kcal' },
  proteinTargetG: { label: 'La proteína', min: 0, max: 1000, unit: 'g' },
  carbsTargetG: { label: 'Los carbohidratos', min: 0, max: 1500, unit: 'g' },
  fatTargetG: { label: 'Las grasas', min: 0, max: 1000, unit: 'g' },
} as const;

export function validateNutritionDocument(
  doc: NutritionDocument,
): NutritionValidationResult {
  const errors: NutritionFieldErrors = { meals: {} };
  const summary: string[] = [];
  let count = 0;

  const pushError = (message: string, assign: () => void) => {
    assign();
    summary.push(message);
    count += 1;
  };

  const trimmedName = doc.name.trim();
  if (!trimmedName) {
    pushError('Escribe un nombre para el plan alimenticio.', () => {
      errors.name = 'El nombre del plan es obligatorio.';
    });
  } else if (trimmedName.length < 3) {
    pushError('El nombre del plan debe tener al menos 3 caracteres.', () => {
      errors.name = 'Mínimo 3 caracteres.';
    });
  } else if (trimmedName.length > 150) {
    pushError('El nombre del plan no debe superar los 150 caracteres.', () => {
      errors.name = 'Máximo 150 caracteres.';
    });
  }

  (Object.keys(MACRO_LIMITS) as (keyof typeof MACRO_LIMITS)[]).forEach((key) => {
    const val = doc[key];
    if (val === null || val === undefined) return;
    const rule = MACRO_LIMITS[key];
    if (!Number.isFinite(val)) {
      pushError(`${rule.label} deben ser un número válido.`, () => {
        errors[key] = 'Ingresa un número válido.';
      });
    } else if (val < rule.min || val > rule.max) {
      pushError(
        `${rule.label} deben estar entre ${rule.min} y ${rule.max} ${rule.unit}.`,
        () => {
          errors[key] = `Rango permitido: ${rule.min} a ${rule.max} ${rule.unit}.`;
        },
      );
    }
  });

  if (doc.meals.length === 0) {
    pushError('Agrega al menos un tiempo de comida al plan.', () => {
      errors.mealsGeneral = 'Debes incluir al menos un tiempo de comida.';
    });
  } else if (doc.meals.length > 12) {
    pushError('Un plan alimenticio admite máximo 12 tiempos de comida.', () => {
      errors.mealsGeneral = 'Máximo 12 tiempos de comida por plan.';
    });
  }

  const seenMealNames = new Set<string>();

  doc.meals.forEach((meal, mealIdx) => {
    const mealLabel = meal.name.trim() || `Comida #${mealIdx + 1}`;
    const mealEntry: NutritionFieldErrors['meals'][string] = { items: {} };
    let hasMealIssue = false;

    const mealName = meal.name.trim();
    if (!mealName) {
      hasMealIssue = true;
      pushError(`Falta el nombre en el tiempo de comida #${mealIdx + 1}.`, () => {
        mealEntry.name = 'Escribe el nombre de esta comida (ej. Desayuno).';
      });
    } else if (mealName.length > 100) {
      hasMealIssue = true;
      pushError(`El nombre de "${mealLabel}" supera 100 caracteres.`, () => {
        mealEntry.name = 'Máximo 100 caracteres.';
      });
    } else {
      const normalized = mealName.toLowerCase();
      if (seenMealNames.has(normalized)) {
        hasMealIssue = true;
        pushError(`El tiempo de comida "${mealName}" está duplicado.`, () => {
          mealEntry.name = 'Ya existe otra comida con este mismo nombre.';
        });
      }
      seenMealNames.add(normalized);
    }

    if (meal.instructions && meal.instructions.length > 2000) {
      hasMealIssue = true;
      pushError(`Las indicaciones de "${mealLabel}" superan 2000 caracteres.`, () => {
        mealEntry.instructions = 'Máximo 2000 caracteres.';
      });
    }

    if (meal.items.length === 0) {
      hasMealIssue = true;
      pushError(`Agrega al menos un alimento en "${mealLabel}".`, () => {
        mealEntry.itemsGeneral = 'Cada tiempo de comida debe tener al menos 1 alimento.';
      });
    }

    meal.items.forEach((item, itemIdx) => {
      const itemEntry: NutritionFieldErrors['meals'][string]['items'][string] = {};
      let hasItemIssue = false;

      const itemName = item.name.trim();
      if (!itemName) {
        hasItemIssue = true;
        pushError(
          `Falta el nombre del alimento #${itemIdx + 1} en "${mealLabel}".`,
          () => {
            itemEntry.name = 'Escribe el alimento.';
          },
        );
      } else if (itemName.length > 150) {
        hasItemIssue = true;
        pushError(
          `El alimento #${itemIdx + 1} en "${mealLabel}" supera 150 caracteres.`,
          () => {
            itemEntry.name = 'Máximo 150 caracteres.';
          },
        );
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        hasItemIssue = true;
        pushError(
          `La cantidad de "${itemName || `Alimento #${itemIdx + 1}`}" en "${mealLabel}" debe ser mayor a 0.`,
          () => {
            itemEntry.quantity = 'Debe ser > 0.';
          },
        );
      } else if (item.quantity > 10000) {
        hasItemIssue = true;
        pushError(
          `La cantidad de "${itemName || `Alimento #${itemIdx + 1}`}" no puede superar 10,000.`,
          () => {
            itemEntry.quantity = 'Máximo 10,000.';
          },
        );
      }

      const unit = item.unit.trim();
      if (!unit) {
        hasItemIssue = true;
        pushError(
          `Falta la unidad de "${itemName || `Alimento #${itemIdx + 1}`}" en "${mealLabel}".`,
          () => {
            itemEntry.unit = 'Ej. g, ml, pza.';
          },
        );
      } else if (unit.length > 50) {
        hasItemIssue = true;
        pushError(
          `La unidad de "${itemName || `Alimento #${itemIdx + 1}`}" supera 50 caracteres.`,
          () => {
            itemEntry.unit = 'Máximo 50 caracteres.';
          },
        );
      }

      if (item.instructions && item.instructions.length > 1000) {
        hasItemIssue = true;
        pushError(
          `La nota de "${itemName || `Alimento #${itemIdx + 1}`}" supera 1000 caracteres.`,
          () => {
            itemEntry.instructions = 'Máximo 1000 caracteres.';
          },
        );
      }

      if (hasItemIssue) {
        mealEntry.items[item.id] = itemEntry;
        hasMealIssue = true;
      }
    });

    if (hasMealIssue) {
      errors.meals[meal.id] = mealEntry;
    }
  });

  return {
    valid: count === 0,
    count,
    summary,
    errors,
  };
}