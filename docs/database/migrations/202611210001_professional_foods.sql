-- EP-05: the professional's own food and recipe library. A plan copies each food's
-- name, portion and macros into its items, so editing or archiving a food here
-- never changes a saved or published plan.
CREATE TABLE private.professional_foods (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  food_group text NOT NULL CHECK (food_group IN ('Proteínas', 'Carbohidratos', 'Grasas saludables', 'Verduras', 'Frutas', 'Lácteos', 'Legumbres', 'Bebidas y suplementos')),
  kind text NOT NULL CHECK (kind IN ('food', 'recipe')),
  basis text NOT NULL CHECK (basis IN ('per_100', 'per_unit')),
  default_unit text NOT NULL CHECK (char_length(default_unit) BETWEEN 1 AND 20),
  default_quantity numeric(6,1) NOT NULL CHECK (default_quantity > 0 AND default_quantity <= 5000),
  calories numeric(6,1) NOT NULL CHECK (calories BETWEEN 0 AND 5000),
  protein_g numeric(5,1) NOT NULL CHECK (protein_g BETWEEN 0 AND 500),
  carbs_g numeric(5,1) NOT NULL CHECK (carbs_g BETWEEN 0 AND 500),
  fat_g numeric(5,1) NOT NULL CHECK (fat_g BETWEEN 0 AND 500),
  preparation text CHECK (char_length(preparation) BETWEEN 1 AND 2000),
  substitutes text CHECK (char_length(substitutes) BETWEEN 1 AND 300),
  ingredients jsonb CHECK (jsonb_typeof(ingredients) = 'array'),
  servings smallint CHECK (servings BETWEEN 1 AND 50),
  suitable_for text[] NOT NULL DEFAULT '{}' CHECK (suitable_for <@ ARRAY['vegan', 'vegetarian', 'dairy_free', 'fish_free', 'gluten_free']),
  meal_categories text[] NOT NULL DEFAULT '{}' CHECK (meal_categories <@ ARRAY['breakfast', 'morning_snack', 'lunch', 'pre_workout', 'post_workout', 'afternoon_snack', 'dinner', 'pre_bed', 'other']),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- A recipe always lists its ingredients and the portions it yields; a food never does.
  CHECK ((kind = 'recipe') = (ingredients IS NOT NULL AND servings IS NOT NULL)),
  CHECK (kind = 'food' OR (basis = 'per_unit' AND ingredients IS NOT NULL))
);
-- One active food per name and professional; archived names can be reused.
CREATE UNIQUE INDEX professional_foods_active_name ON private.professional_foods (owner_id, lower(name)) WHERE archived_at IS NULL;

ALTER TABLE private.professional_foods ENABLE ROW LEVEL SECURITY;
-- Only the owner, while active with a current subscription, reads or writes the library.
CREATE POLICY professional_foods_owner ON private.professional_foods FOR ALL TO couchone_authentication
  USING (private.nutrition_professional(owner_id))
  WITH CHECK (private.nutrition_professional(owner_id));

GRANT SELECT, INSERT ON private.professional_foods TO couchone_authentication;
GRANT UPDATE (name, food_group, kind, basis, default_unit, default_quantity, calories, protein_g, carbs_g, fat_g,
  preparation, substitutes, ingredients, servings, suitable_for, meal_categories, revision, archived_at, updated_at)
  ON private.professional_foods TO couchone_authentication;
