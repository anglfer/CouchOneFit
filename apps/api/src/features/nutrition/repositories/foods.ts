import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthError } from '../../auth/types/errors.js';
import type { FoodIngredient, ProfessionalFood, ProfessionalFoodInput } from '../types/foods.js';

const columns = `id, name, food_group, kind, basis, default_unit, default_quantity, calories, protein_g, carbs_g,
  fat_g, preparation, substitutes, ingredients, servings, suitable_for, meal_categories, revision, updated_at`;

interface FoodRow {
  id: string;
  name: string;
  food_group: ProfessionalFood['group'];
  kind: ProfessionalFood['kind'];
  basis: ProfessionalFood['basis'];
  default_unit: string;
  default_quantity: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  preparation: string | null;
  substitutes: string | null;
  ingredients: FoodIngredient[] | null;
  servings: number | null;
  suitable_for: ProfessionalFood['suitableFor'];
  meal_categories: ProfessionalFood['mealCategories'];
  revision: number;
  updated_at: Date;
}

const map = (row: FoodRow): ProfessionalFood => ({
  id: row.id,
  name: row.name,
  group: row.food_group,
  kind: row.kind,
  basis: row.basis,
  defaultUnit: row.default_unit,
  defaultQuantity: Number(row.default_quantity),
  calories: Number(row.calories),
  proteinG: Number(row.protein_g),
  carbsG: Number(row.carbs_g),
  fatG: Number(row.fat_g),
  preparation: row.preparation,
  substitutes: row.substitutes,
  ingredients: row.ingredients,
  servings: row.servings,
  suitableFor: row.suitable_for,
  mealCategories: row.meal_categories,
  revision: row.revision,
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const foodMissing = (): never => {
  throw new AuthError(404, 'FOOD_NOT_FOUND', 'El alimento no está disponible.');
};
const foodConflict = (): never => {
  throw new AuthError(409, 'FOOD_CONFLICT', 'El alimento cambió en otra sesión. Actualiza antes de guardar.');
};

// The partial unique index guards the name even when two saves race.
async function guardName<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new AuthError(409, 'FOOD_NAME_TAKEN', 'Ya tienes un alimento con ese nombre.', {
        name: 'Usa otro nombre o edita el alimento existente.',
      });
    throw error;
  }
}

const values = (f: ProfessionalFoodInput) => [
  f.name,
  f.group,
  f.kind,
  f.basis,
  f.defaultUnit,
  f.defaultQuantity,
  f.calories,
  f.proteinG,
  f.carbsG,
  f.fatG,
  f.preparation,
  f.substitutes,
  f.ingredients === null ? null : JSON.stringify(f.ingredients),
  f.servings,
  f.suitableFor,
  f.mealCategories,
];

export async function list(c: PoolClient, ownerId: string): Promise<ProfessionalFood[]> {
  const { rows } = await c.query<FoodRow>(
    `SELECT ${columns} FROM private.professional_foods
     WHERE owner_id = $1 AND archived_at IS NULL ORDER BY lower(name), id`,
    [ownerId],
  );
  return rows.map(map);
}

export async function insert(c: PoolClient, ownerId: string, food: ProfessionalFoodInput): Promise<ProfessionalFood> {
  const {
    rows: [row],
  } = await guardName(
    c.query<FoodRow>(
      `INSERT INTO private.professional_foods (id, owner_id, name, food_group, kind, basis, default_unit,
         default_quantity, calories, protein_g, carbs_g, fat_g, preparation, substitutes, ingredients, servings,
         suitable_for, meal_categories)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18)
       RETURNING ${columns}`,
      [randomUUID(), ownerId, ...values(food)],
    ),
  );
  return map(row);
}

/** Optimistic write on an active food: a stale revision is a conflict, a foreign or archived id is missing. */
async function change(c: PoolClient, ownerId: string, id: string, revision: number, set: string, extra: unknown[]) {
  const { rows } = await guardName(
    c.query<FoodRow>(
      `UPDATE private.professional_foods SET ${set}, revision = revision + 1, updated_at = clock_timestamp()
       WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL AND revision = $3 RETURNING ${columns}`,
      [id, ownerId, revision, ...extra],
    ),
  );
  if (rows[0]) return map(rows[0]);
  const { rowCount } = await c.query(
    'SELECT 1 FROM private.professional_foods WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL',
    [id, ownerId],
  );
  return rowCount ? foodConflict() : foodMissing();
}

export const update = (c: PoolClient, ownerId: string, id: string, revision: number, food: ProfessionalFoodInput) =>
  change(
    c,
    ownerId,
    id,
    revision,
    `name = $4, food_group = $5, kind = $6, basis = $7, default_unit = $8, default_quantity = $9, calories = $10,
     protein_g = $11, carbs_g = $12, fat_g = $13, preparation = $14, substitutes = $15, ingredients = $16::jsonb,
     servings = $17, suitable_for = $18, meal_categories = $19`,
    values(food),
  );

// Logical removal: plans already hold their own copy of the food.
export const archive = (c: PoolClient, ownerId: string, id: string, revision: number) =>
  change(c, ownerId, id, revision, 'archived_at = clock_timestamp()', []);
