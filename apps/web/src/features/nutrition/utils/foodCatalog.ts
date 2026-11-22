import type {
  NutritionDocument,
  NutritionItem,
  NutritionMeal,
  NutritionMealCategory,
} from '../types/nutrition';

export const FOOD_GROUPS = [
  'Proteínas',
  'Carbohidratos',
  'Grasas saludables',
  'Verduras',
  'Frutas',
  'Lácteos',
  'Legumbres',
  'Bebidas y suplementos',
] as const;

export type FoodGroup = (typeof FOOD_GROUPS)[number];

export interface CatalogFood {
  id: string;
  name: string;
  group: FoodGroup;
  synonyms: readonly string[];
  defaultUnit: string;
  defaultQuantity: number;
  basis: 'per_100' | 'per_unit';
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  preparationHint: string;
  defaultSubstitutes: string;
  /** Only foods from the professional's own library (EP-05) carry this. */
  own?: {
    kind: 'food' | 'recipe';
    suitableFor: readonly FoodRestriction[];
    mealCategories: readonly NutritionMealCategory[];
  };
}

export const FOOD_RESTRICTIONS = [
  ['vegan', 'Vegano'],
  ['vegetarian', 'Vegetariano'],
  ['dairy_free', 'Sin lácteos'],
  ['fish_free', 'Sin pescado'],
  ['gluten_free', 'Sin gluten'],
] as const;
export type FoodRestriction = (typeof FOOD_RESTRICTIONS)[number][0];

export const COMMON_UNITS = [
  'g',
  'ml',
  'pza',
  'taza',
  'cda',
  'cdta',
  'scoop',
  'rebanada',
  'porción',
];

export const MEAL_CATEGORY_OPTIONS: ReadonlyArray<
  [NutritionMealCategory, string]
> = [
  ['breakfast', 'Desayuno'],
  ['morning_snack', 'Colación matutina'],
  ['lunch', 'Comida principal'],
  ['pre_workout', 'Pre-entreno'],
  ['post_workout', 'Post-entreno'],
  ['afternoon_snack', 'Merienda / Tarde'],
  ['dinner', 'Cena'],
  ['pre_bed', 'Colación nocturna'],
  ['other', 'Otro tiempo'],
];

let ownFoods: readonly CatalogFood[] = [];

/** The professional's library joins the curated catalog wherever foods are searched or suggested. */
export function setOwnFoods(list: readonly CatalogFood[]): void {
  ownFoods = list;
}

// Own foods first: a professional's version of a food wins over the curated one.
export const allFoods = (): readonly CatalogFood[] => [
  ...ownFoods,
  ...FOOD_CATALOG,
];

const f = (
  id: string,
  name: string,
  group: FoodGroup,
  synonyms: readonly string[],
  defaultUnit: string,
  defaultQuantity: number,
  basis: 'per_100' | 'per_unit',
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  preparationHint: string,
  defaultSubstitutes: string
): CatalogFood => ({
  id,
  name,
  group,
  synonyms,
  defaultUnit,
  defaultQuantity,
  basis,
  calories,
  proteinG,
  carbsG,
  fatG,
  preparationHint,
  defaultSubstitutes,
});

export const FOOD_CATALOG: readonly CatalogFood[] = [
  // Proteínas
  f(
    'chicken-breast',
    'Pechuga de pollo',
    'Proteínas',
    ['pollo', 'pechuga', 'ave'],
    'g',
    150,
    'per_100',
    110,
    23,
    0,
    1.5,
    'Peso en crudo, a la plancha o vapor',
    'Pavo, lomo de cerdo magro o pescado blanco'
  ),
  f(
    'turkey-breast',
    'Pechuga de pavo',
    'Proteínas',
    ['pavo', 'pechuga pavo'],
    'g',
    150,
    'per_100',
    107,
    23.5,
    0,
    1.1,
    'En crudo a la plancha',
    'Pechuga de pollo o claras de huevo'
  ),
  f(
    'lean-beef',
    'Carne magra de res',
    'Proteínas',
    ['res', 'bistec', 'filete', 'molida magra', 'arrachera magra'],
    'g',
    150,
    'per_100',
    142,
    22,
    0,
    5.5,
    'Corte magro 95/5 en crudo',
    'Pechuga de pollo o lomo de cerdo'
  ),
  f(
    'pork-tenderloin',
    'Lomo de cerdo magro',
    'Proteínas',
    ['cerdo', 'lomo', 'puerco magro'],
    'g',
    150,
    'per_100',
    120,
    21.5,
    0,
    3.2,
    'Sin grasa visible, peso en crudo',
    'Pechuga de pollo o bistec magro'
  ),
  f(
    'tuna',
    'Atún',
    'Proteínas',
    ['atun en agua', 'lata de atun', 'pescado'],
    'g',
    120,
    'per_100',
    108,
    24,
    0,
    0.9,
    'Drenado en agua o al natural',
    'Pechuga de pollo o salmón (ajustar grasas)'
  ),
  f(
    'salmon',
    'Salmón fresco',
    'Proteínas',
    ['salmon', 'pescado graso'],
    'g',
    140,
    'per_100',
    208,
    20,
    0,
    13.4,
    'A la plancha o al horno',
    'Trucha, sardinas o atún + 10 g nueces'
  ),
  f(
    'white-fish',
    'Filete de pescado blanco (tilapia / merluza)',
    'Proteínas',
    ['tilapia', 'basa', 'merluza', 'robalo', 'huachinango'],
    'g',
    160,
    'per_100',
    96,
    20,
    0,
    1.7,
    'A la plancha o empapelado',
    'Camarón, atún en agua o pollo'
  ),
  f(
    'shrimp',
    'Camarón limpio',
    'Proteínas',
    ['camarones', 'gambas', 'mariscos'],
    'g',
    150,
    'per_100',
    85,
    20,
    0,
    0.5,
    'Peso en crudo, cocido o salteado',
    'Pescado blanco o claras'
  ),
  f(
    'sardines',
    'Sardinas en agua / tomate',
    'Proteínas',
    ['sardina', 'pescado azul'],
    'g',
    100,
    'per_100',
    165,
    21,
    0,
    8.8,
    'Escurridas; excelente fuente de omega-3',
    'Salmón o caballa'
  ),
  f(
    'whole-egg',
    'Huevo entero',
    'Proteínas',
    ['huevos', 'blanquillo', 'yema'],
    'pza',
    2,
    'per_unit',
    72,
    6.3,
    0.4,
    4.8,
    'Cocido, revuelto o a la plancha sin exceso de aceite',
    '3 claras por huevo o 40 g de queso panela'
  ),
  f(
    'egg-whites',
    'Claras de huevo',
    'Proteínas',
    ['claras', 'huevo clara'],
    'ml',
    150,
    'per_100',
    52,
    11,
    0.7,
    0.2,
    'Pasteurizadas o naturales bien cocidas',
    'Pechuga de pavo o scoop de proteína'
  ),
  f(
    'tofu-firm',
    'Tofu firme',
    'Proteínas',
    ['tofu', 'soya'],
    'g',
    150,
    'per_100',
    144,
    15.8,
    2.8,
    8.2,
    'Escurrido, marinado o sellado en sartén',
    'Tempeh, edamame o seitán'
  ),
  f(
    'tempeh',
    'Tempeh',
    'Proteínas',
    ['soya fermentada', 'proteina vegana'],
    'g',
    120,
    'per_100',
    193,
    20,
    7.6,
    10.8,
    'En láminas a la plancha o horneado',
    'Tofu firme o seitán'
  ),
  f(
    'seitan',
    'Seitán',
    'Proteínas',
    ['seitan', 'gluten de trigo'],
    'g',
    120,
    'per_100',
    128,
    24,
    4.5,
    1.5,
    'Contiene gluten; sellar en sartén',
    'Tofu firme o proteína vegetal en polvo'
  ),
  f(
    'ham-turkey',
    'Jamón de pechuga de pavo',
    'Proteínas',
    ['jamon', 'embutido magro'],
    'rebanada',
    3,
    'per_unit',
    30,
    5.2,
    1.0,
    0.5,
    'Bajo en sodio, preferencia artesanal/horneado',
    'Claras de huevo o queso panela'
  ),
  f(
    'machaca',
    'Carne seca / machaca magra',
    'Proteínas',
    ['carne seca', 'deshebrada'],
    'g',
    40,
    'per_100',
    270,
    54,
    2,
    4,
    'Rehidratada o como topping proteico',
    'Bistec magro o atún'
  ),

  // Carbohidratos
  f(
    'oats',
    'Avena en hojuelas',
    'Carbohidratos',
    ['avena', 'copos de avena', 'oatmeal'],
    'g',
    50,
    'per_100',
    379,
    13.2,
    67.7,
    6.5,
    'Peso en seco; cocida en agua o bebida vegetal',
    'Pan integral, arroz o granola sin azúcar'
  ),
  f(
    'white-rice',
    'Arroz blanco cocido',
    'Carbohidratos',
    ['arroz', 'basmati', 'jazmin'],
    'g',
    150,
    'per_100',
    130,
    2.7,
    28.2,
    0.3,
    'Peso ya cocido y escurrido',
    'Arroz integral, pasta cocida o papa cocida'
  ),
  f(
    'white-rice-raw',
    'Arroz blanco en crudo',
    'Carbohidratos',
    ['arroz crudo', 'arroz seco'],
    'g',
    60,
    'per_100',
    360,
    7.1,
    79,
    0.7,
    'Peso en seco antes de cocción',
    'Pasta seca, avena o quinua cruda'
  ),
  f(
    'brown-rice',
    'Arroz integral cocido',
    'Carbohidratos',
    ['arroz integral', 'arroz'],
    'g',
    150,
    'per_100',
    123,
    2.7,
    25.6,
    1.0,
    'Peso ya cocido',
    'Quinua cocida o arroz blanco'
  ),
  f(
    'quinoa',
    'Quinua cocida',
    'Carbohidratos',
    ['quinoa', 'quinua'],
    'g',
    140,
    'per_100',
    120,
    4.4,
    21.3,
    1.9,
    'Enjuagar antes de cocer; peso ya cocido',
    'Arroz integral o cuscús'
  ),
  f(
    'pasta-cooked',
    'Pasta cocida (integral o tradicional)',
    'Carbohidratos',
    ['pasta', 'espagueti', 'fusilli', 'macarrones'],
    'g',
    150,
    'per_100',
    148,
    5.4,
    29.8,
    0.9,
    'Peso cocido al dente',
    'Arroz cocido o papa horneada'
  ),
  f(
    'potato',
    'Papa blanca cocida / horneada',
    'Carbohidratos',
    ['papa', 'patata'],
    'g',
    200,
    'per_100',
    87,
    1.9,
    20.1,
    0.1,
    'Peso cocida con o sin cáscara',
    'Camote o arroz cocido'
  ),
  f(
    'sweet-potato',
    'Camote amarillo / morado cocido',
    'Carbohidratos',
    ['camote', 'batata', 'boniato'],
    'g',
    180,
    'per_100',
    90,
    2.0,
    20.7,
    0.1,
    'Horneado o al vapor',
    'Papa cocida o plátano macho'
  ),
  f(
    'corn-tortilla',
    'Tortilla de maíz',
    'Carbohidratos',
    ['tortilla', 'maiz', 'tortillas'],
    'pza',
    3,
    'per_unit',
    54,
    1.4,
    11.2,
    0.6,
    'Tortilla tradicional ~25-30 g c/u',
    'Tostadas horneadas (2 pzas = 1 tortilla) o pan integral'
  ),
  f(
    'corn-kernels',
    'Maíz',
    'Carbohidratos',
    ['elote', 'choclo', 'granos de elote', 'maiz desgranado'],
    'g',
    100,
    'per_100',
    86,
    3.2,
    19.0,
    1.2,
    'Granos cocidos o elote desgranado',
    'Papa cocida o 1.5 tortillas de maíz'
  ),
  f(
    'whole-wheat-bread',
    'Pan de caja integral',
    'Carbohidratos',
    ['pan', 'pan tostado', 'integral', 'rebanada'],
    'rebanada',
    2,
    'per_unit',
    74,
    3.5,
    13.0,
    1.1,
    'Tostado o en sándwich (~28-30 g por rebanada)',
    '2 tortillas de maíz o 35 g de avena'
  ),
  f(
    'sourdough-bread',
    'Pan masa madre / bolillo integral',
    'Carbohidratos',
    ['masa madre', 'bolillo', 'pan artesanal'],
    'g',
    60,
    'per_100',
    250,
    8.8,
    49.0,
    1.5,
    'Sin migajón si se busca menor carga calórica',
    '2 rebanadas de pan integral o 3 tortillas'
  ),
  f(
    'baked-tostadas',
    'Tostadas de maíz horneadas',
    'Carbohidratos',
    ['tostadas', 'horneadas'],
    'pza',
    3,
    'per_unit',
    38,
    0.9,
    7.8,
    0.4,
    'Horneadas (no fritas)',
    'Tortilla de maíz (1.5 tostadas ≈ 1 tortilla)'
  ),
  f(
    'rice-cakes',
    'Tortitas de arroz inflado',
    'Carbohidratos',
    ['galletas de arroz', 'rice cakes', 'arroz inflado'],
    'pza',
    3,
    'per_unit',
    35,
    0.7,
    7.3,
    0.3,
    'Ideales pre-entreno de digestión rápida',
    'Pan blanco tostado o plátano'
  ),
  f(
    'plantain',
    'Plátano macho cocido / asado',
    'Carbohidratos',
    ['platano macho', 'macho'],
    'g',
    120,
    'per_100',
    116,
    0.8,
    31.1,
    0.2,
    'Asado o hervido sin aceite añadido',
    'Camote o arroz cocido'
  ),
  f(
    'corn-flakes',
    'Cereal de maíz o arroz inflado sin azúcar',
    'Carbohidratos',
    ['corn flakes', 'cereal', 'choco krispis', 'rice krispies'],
    'g',
    40,
    'per_100',
    375,
    7.0,
    84.0,
    0.9,
    'Útil alrededor del entrenamiento por digestión rápida',
    'Avena o tortitas de arroz'
  ),
  f(
    'honey',
    'Miel natural',
    'Carbohidratos',
    ['miel de abeja', 'azucar libre'],
    'cda',
    1,
    'per_unit',
    64,
    0.1,
    17.3,
    0,
    'Contabilizar dentro de azúcares libres (<10% kcal)',
    'Mermelada sin azúcar o fruta madura'
  ),
  f(
    'bagel',
    'Bagel natural o integral',
    'Carbohidratos',
    ['bagel', 'pan redondo'],
    'pza',
    1,
    'per_unit',
    245,
    9.5,
    48.0,
    1.5,
    'Excelente opción pre/post entrenamiento',
    '3 rebanadas de pan integral'
  ),

  // Grasas saludables
  f(
    'avocado',
    'Aguacate',
    'Grasas saludables',
    ['palta', 'aguacate hass'],
    'g',
    60,
    'per_100',
    160,
    2.0,
    8.5,
    14.7,
    'En rebanadas o machacado (~1/3 pieza mediana = 50 g)',
    '10 ml de aceite de oliva o 15 g de nueces'
  ),
  f(
    'olive-oil',
    'Aceite de oliva extra virgen',
    'Grasas saludables',
    ['aove', 'aceite oliva', 'aceite'],
    'cdta',
    1,
    'per_unit',
    44,
    0,
    0,
    5.0,
    '1 cdta = 5 ml; medir con cuchara antes de cocinar',
    'Aceite de aguacate o 30 g de aguacate'
  ),
  f(
    'peanut-butter',
    'Crema de cacahuate natural',
    'Grasas saludables',
    ['mantequilla de mani', 'crema mani', 'cacahuate'],
    'cda',
    1,
    'per_unit',
    94,
    4.0,
    3.1,
    8.0,
    '100% cacahuate sin aceites ni azúcares añadidos (~16 g)',
    'Crema de almendra o 15 g de almendras'
  ),
  f(
    'almonds',
    'Almendras naturales',
    'Grasas saludables',
    ['almendra', 'frutos secos'],
    'g',
    20,
    'per_100',
    579,
    21.2,
    21.6,
    49.9,
    'Naturales o tostadas sin sal añadida (~16-18 piezas = 20 g)',
    'Nueces, pistaches o cacahuates'
  ),
  f(
    'walnuts',
    'Nueces de castilla / pecanas',
    'Grasas saludables',
    ['nuez', 'nueces', 'frutos secos'],
    'g',
    20,
    'per_100',
    654,
    15.2,
    13.7,
    65.2,
    'Ricas en ALA (omega-3 vegetal)',
    'Almendras o semillas de chía'
  ),
  f(
    'peanuts',
    'Cacahuates tostados sin sal',
    'Grasas saludables',
    ['mani', 'cacahuate'],
    'g',
    25,
    'per_100',
    587,
    24.4,
    21.3,
    49.7,
    'Medir porción en gramos o cucharadas',
    'Almendras o pepitas de calabaza'
  ),
  f(
    'chia-seeds',
    'Semillas de chía',
    'Grasas saludables',
    ['chia', 'semilla'],
    'cda',
    1,
    'per_unit',
    58,
    2.0,
    5.0,
    3.7,
    'Hidratar en agua/yogur o agregar a avena (~12 g)',
    'Linaza molida o semillas de cáñamo'
  ),
  f(
    'flax-seeds',
    'Linaza molida',
    'Grasas saludables',
    ['lino', 'semillas lino'],
    'cda',
    1,
    'per_unit',
    53,
    1.8,
    2.9,
    4.2,
    'Preferir molida para mejor absorción',
    'Semillas de chía o nueces'
  ),
  f(
    'pumpkin-seeds',
    'Pepitas de calabaza',
    'Grasas saludables',
    ['semillas de calabaza', 'pepitas'],
    'g',
    20,
    'per_100',
    559,
    30.2,
    10.7,
    49.0,
    'Tostadas sin aceite extra',
    'Girasol, almendras o cacahuates'
  ),
  f(
    'dark-chocolate',
    'Chocolate amargo ≥70% cacao',
    'Grasas saludables',
    ['chocolate negro', 'cacao'],
    'g',
    15,
    'per_100',
    598,
    7.8,
    45.9,
    42.6,
    'Porción moderada sin relleno',
    '15 g de almendras o cacao nibs'
  ),
  f(
    'olives',
    'Aceitunas negras o verdes',
    'Grasas saludables',
    ['aceituna', 'olivas'],
    'g',
    40,
    'per_100',
    115,
    0.8,
    6.3,
    10.7,
    'Escurridas; vigilar aporte de sodio',
    '25 g de aguacate'
  ),

  // Verduras
  f(
    'spinach',
    'Espinaca fresca',
    'Verduras',
    ['espinacas', 'hoja verde'],
    'g',
    80,
    'per_100',
    23,
    2.9,
    3.6,
    0.4,
    'Cruda en ensalada/licuado o salteada',
    'Acelga, arúgula o kale'
  ),
  f(
    'broccoli',
    'Brócoli al vapor',
    'Verduras',
    ['brocoli', 'cruciferas'],
    'g',
    150,
    'per_100',
    35,
    2.4,
    7.2,
    0.4,
    'Al vapor 4–5 min para conservar textura',
    'Coliflor, ejotes o espárragos'
  ),
  f(
    'zucchini',
    'Calabacita italiana',
    'Verduras',
    ['calabacin', 'calabaza verde'],
    'g',
    150,
    'per_100',
    17,
    1.2,
    3.1,
    0.3,
    'Asada, al vapor o en rodajas',
    'Chayote, pepino o berenjena'
  ),
  f(
    'nopales',
    'Nopales cocidos / asados',
    'Verduras',
    ['nopal', 'verdura mexicana'],
    'g',
    150,
    'per_100',
    16,
    1.3,
    3.3,
    0.1,
    'Asados o cocidos; excelente aporte de fibra',
    'Ejotes, espinaca o calabacita'
  ),
  f(
    'tomato',
    'Jitomate / tomate rojo',
    'Verduras',
    ['tomate', 'jitomate'],
    'g',
    120,
    'per_100',
    18,
    0.9,
    3.9,
    0.2,
    'Crudo en pico de gallo o cocido en salsa',
    'Pimiento rojo o pepino'
  ),
  f(
    'bell-pepper',
    'Pimiento morrón (rojo / amarillo / verde)',
    'Verduras',
    ['pimiento', 'chile morron'],
    'g',
    100,
    'per_100',
    31,
    1.0,
    6.0,
    0.3,
    'Crudo o salteado en tiras',
    'Zanahoria o jitomate'
  ),
  f(
    'cucumber',
    'Pepino con cáscara o pelado',
    'Verduras',
    ['pepino', 'ensalada'],
    'g',
    120,
    'per_100',
    15,
    0.7,
    3.6,
    0.1,
    'Fresco en rodajas con limón',
    'Apio, jícama o lechuga'
  ),
  f(
    'lettuce',
    'Lechuga romana / mezcla de hojas verdes',
    'Verduras',
    ['lechuga', 'ensalada verde', 'arugula'],
    'g',
    100,
    'per_100',
    17,
    1.2,
    3.3,
    0.3,
    'Base de volumen y micronutrientes',
    'Espinaca o col rizada'
  ),
  f(
    'carrot',
    'Zanahoria',
    'Verduras',
    ['zanahorias'],
    'g',
    100,
    'per_100',
    41,
    0.9,
    9.6,
    0.2,
    'Rallada cruda o al vapor',
    'Betabel o calabacita'
  ),
  f(
    'green-beans',
    'Ejotes verdes',
    'Verduras',
    ['ejote', 'judias verdes', 'vainitas'],
    'g',
    120,
    'per_100',
    31,
    1.8,
    7.0,
    0.2,
    'Cocidos al vapor o salteados',
    'Brócoli, espárragos o nopales'
  ),
  f(
    'mushrooms',
    'Champiñones frescos',
    'Verduras',
    ['hongos', 'setas', 'champinon'],
    'g',
    100,
    'per_100',
    22,
    3.1,
    3.3,
    0.3,
    'Salteados sin exceso de grasa',
    'Calabacita o espárragos'
  ),
  f(
    'asparagus',
    'Espárragos verdes',
    'Verduras',
    ['esparragos'],
    'g',
    120,
    'per_100',
    20,
    2.2,
    3.9,
    0.1,
    'A la plancha o al horno',
    'Ejotes o brócoli'
  ),
  f(
    'cauliflower',
    'Coliflor',
    'Verduras',
    ['coliflor', 'arroz de coliflor'],
    'g',
    150,
    'per_100',
    25,
    1.9,
    5.0,
    0.3,
    'Al vapor o rallada como guarnición ligera',
    'Brócoli o chayote'
  ),
  f(
    'chayote',
    'Chayote cocido',
    'Verduras',
    ['chayote'],
    'g',
    150,
    'per_100',
    19,
    0.8,
    4.5,
    0.1,
    'Cocido en cubos o tiras',
    'Calabacita o jícama'
  ),

  // Frutas
  f(
    'banana',
    'Plátano tabasco',
    'Frutas',
    ['banana', 'banano', 'cambur'],
    'pza',
    1,
    'per_unit',
    105,
    1.3,
    27.0,
    0.4,
    'Pieza mediana (~118 g sin cáscara)',
    '1 manzana mediana o 150 g de fresas'
  ),
  f(
    'apple',
    'Manzana',
    'Frutas',
    ['manzana roja', 'manzana verde'],
    'pza',
    1,
    'per_unit',
    95,
    0.5,
    25.0,
    0.3,
    'Entera con cáscara para mayor saciedad (~180 g)',
    '1 pera o 1 plátano chico'
  ),
  f(
    'strawberries',
    'Fresas frescas',
    'Frutas',
    ['fresa', 'frutillas', 'berries'],
    'g',
    150,
    'per_100',
    32,
    0.7,
    7.7,
    0.3,
    'Lavadas y desinfectadas',
    'Arándanos, frambuesas o zarzamoras'
  ),
  f(
    'blueberries',
    'Arándanos azules (blueberries)',
    'Frutas',
    ['arandanos', 'moras azules', 'berries'],
    'g',
    100,
    'per_100',
    57,
    0.7,
    14.5,
    0.3,
    'Frescos o congelados',
    'Fresas o frambuesas'
  ),
  f(
    'papaya',
    'Papaya picada',
    'Frutas',
    ['papaya'],
    'g',
    180,
    'per_100',
    43,
    0.5,
    10.8,
    0.3,
    'En cubos, ideal en el desayuno',
    'Melón o sandía'
  ),
  f(
    'watermelon',
    'Sandía',
    'Frutas',
    ['sandia'],
    'g',
    220,
    'per_100',
    30,
    0.6,
    7.6,
    0.2,
    'Alta hidratación y baja densidad calórica',
    'Melón o papaya'
  ),
  f(
    'melon',
    'Melón cantalupo',
    'Frutas',
    ['melon'],
    'g',
    200,
    'per_100',
    34,
    0.8,
    8.2,
    0.2,
    'En cubos frescos',
    'Papaya o sandía'
  ),
  f(
    'orange',
    'Naranja entera en gajos',
    'Frutas',
    ['naranja', 'citrico'],
    'pza',
    1,
    'per_unit',
    62,
    1.2,
    15.4,
    0.2,
    'Consumir entera, evitar en jugo para conservar fibra',
    '2 mandarinas o 1 kiwi'
  ),
  f(
    'kiwi',
    'Kiwi',
    'Frutas',
    ['kiwis'],
    'pza',
    2,
    'per_unit',
    42,
    0.8,
    10.1,
    0.4,
    'Rico en vitamina C y fibra (~70 g c/u)',
    '150 g de fresas o 1 naranja'
  ),
  f(
    'mango',
    'Mango ataúlfo / manila',
    'Frutas',
    ['mango'],
    'g',
    150,
    'per_100',
    60,
    0.8,
    15.0,
    0.4,
    'En rebanadas; buena carga de carbos peri-entreno',
    '1 plátano o 150 g de piña'
  ),
  f(
    'pineapple',
    'Piña fresca',
    'Frutas',
    ['pina', 'anana'],
    'g',
    160,
    'per_100',
    50,
    0.5,
    13.1,
    0.1,
    'Natural en cubos (no en almíbar)',
    'Papaya o mango'
  ),
  f(
    'pear',
    'Pera',
    'Frutas',
    ['peras'],
    'pza',
    1,
    'per_unit',
    101,
    0.6,
    27.0,
    0.2,
    'Con cáscara bien lavada',
    '1 manzana mediana'
  ),
  f(
    'grapes',
    'Uvas rojas o verdes',
    'Frutas',
    ['uva', 'uvas'],
    'g',
    120,
    'per_100',
    69,
    0.7,
    18.1,
    0.2,
    'Medir porción en gramos o taza (~120 g)',
    '120 g de mango o 1 plátano chico'
  ),
  f(
    'guava',
    'Guayaba',
    'Frutas',
    ['guayabas'],
    'pza',
    2,
    'per_unit',
    38,
    1.4,
    7.9,
    0.5,
    'Entera con cáscara (~55 g c/u)',
    '2 kiwis o 150 g de fresas'
  ),

  // Lácteos
  f(
    'greek-yogurt',
    'Yogur griego natural sin azúcar',
    'Lácteos',
    ['yogurt griego', 'yogur', 'lacteo'],
    'g',
    150,
    'per_100',
    59,
    10.2,
    3.6,
    0.4,
    'Descremado o bajo en grasa, sin azúcar añadida',
    'Queso cottage o yogur vegetal alto en proteína'
  ),
  f(
    'cottage-cheese',
    'Queso cottage bajo en grasa',
    'Lácteos',
    ['cottage', 'requeson'],
    'g',
    150,
    'per_100',
    81,
    11.1,
    3.4,
    2.3,
    'Excelente opción pre-cama por caseína',
    'Yogur griego o queso panela'
  ),
  f(
    'panela-cheese',
    'Queso panela fresco',
    'Lácteos',
    ['panela', 'queso fresco'],
    'g',
    60,
    'per_100',
    225,
    18.5,
    2.5,
    15.5,
    'Rebanado o asado en sartén',
    'Requesón, cottage o 1.5 huevos'
  ),
  f(
    'requeson',
    'Requesón fresco',
    'Lácteos',
    ['ricotta', 'requeson'],
    'g',
    80,
    'per_100',
    138,
    11.4,
    3.0,
    8.8,
    'Untable sobre tostadas o pan integral',
    'Queso cottage o panela'
  ),
  f(
    'oaxaca-cheese',
    'Queso Oaxaca / mozzarella parcialmente descremado',
    'Lácteos',
    ['quesillo', 'mozzarella', 'oaxaca'],
    'g',
    40,
    'per_100',
    254,
    24.3,
    2.8,
    16.0,
    'Para fundir en porción medida',
    'Queso panela o cottage'
  ),
  f(
    'skim-milk',
    'Leche descremada o light',
    'Lácteos',
    ['leche', 'descremada'],
    'ml',
    240,
    'per_100',
    35,
    3.4,
    5.0,
    0.2,
    '1 taza = 240 ml',
    'Bebida de soya sin azúcar o leche deslactosada'
  ),
  f(
    'lactose-free-milk',
    'Leche deslactosada semidescremada',
    'Lácteos',
    ['deslactosada', 'leche'],
    'ml',
    240,
    'per_100',
    46,
    3.3,
    4.9,
    1.5,
    'Sin lactosa para mejor tolerancia digestiva',
    'Bebida de soya o almendra fortificada'
  ),
  f(
    'kefir',
    'Kéfir natural sin azúcar',
    'Lácteos',
    ['kefir', 'fermentado'],
    'ml',
    200,
    'per_100',
    45,
    3.5,
    4.5,
    1.2,
    'Fuente natural de probióticos',
    'Yogur griego diluido o yogur natural sin azúcar'
  ),

  // Legumbres
  f(
    'black-beans',
    'Frijoles negros / bayos cocidos',
    'Legumbres',
    ['frijol', 'frijoles', 'leguminosas'],
    'g',
    130,
    'per_100',
    132,
    8.9,
    23.7,
    0.5,
    'Peso ya cocidos y drenados',
    'Lentejas cocidas o garbanzos'
  ),
  f(
    'lentils',
    'Lentejas cocidas',
    'Legumbres',
    ['lenteja', 'lentejas'],
    'g',
    140,
    'per_100',
    116,
    9.0,
    20.1,
    0.4,
    'Cocidas sin grasa añadida',
    'Frijoles cocidos o garbanzos'
  ),
  f(
    'chickpeas',
    'Garbanzos cocidos',
    'Legumbres',
    ['garbanzo', 'hummus'],
    'g',
    130,
    'per_100',
    164,
    8.9,
    27.4,
    2.6,
    'En ensalada, guiso o tostados al horno',
    'Frijoles o lentejas'
  ),
  f(
    'edamame',
    'Edamame pelado cocido',
    'Legumbres',
    ['soya verde', 'edamame'],
    'g',
    100,
    'per_100',
    121,
    11.9,
    8.9,
    5.2,
    'Excelente proteína vegetal completa',
    'Tofu firme o garbanzos'
  ),
  f(
    'hummus',
    'Hummus de garbanzo natural',
    'Legumbres',
    ['hummus', 'pasta de garbanzo'],
    'g',
    50,
    'per_100',
    166,
    7.9,
    14.3,
    9.6,
    'Ideal como dip con verduras o en sándwich',
    '50 g aguacate o 70 g frijoles molidos'
  ),

  // Bebidas y suplementos
  f(
    'whey-protein',
    'Proteína en polvo (Whey / Aislada)',
    'Bebidas y suplementos',
    ['whey', 'suero de leche', 'scoop', 'proteina polvo'],
    'scoop',
    1,
    'per_unit',
    120,
    24.0,
    2.5,
    1.2,
    '1 scoop (~30 g) disuelto en agua o leche; conveniencia opcional',
    '150 g yogur griego o 120 g pechuga de pollo'
  ),
  f(
    'plant-protein',
    'Proteína vegetal en polvo (arroz + guisante / soya)',
    'Bebidas y suplementos',
    ['proteina vegana', 'chicharo', 'arroz', 'soya polvo'],
    'scoop',
    1,
    'per_unit',
    125,
    22.0,
    4.0,
    2.0,
    'Mezcla complementaria para perfil completo de aminoácidos',
    '150 g tofu firme o 150 g edamame'
  ),
  f(
    'casein-protein',
    'Caseína micelar en polvo',
    'Bebidas y suplementos',
    ['caseina', 'pre cama'],
    'scoop',
    1,
    'per_unit',
    118,
    24.0,
    3.0,
    1.0,
    'Digestión lenta; útil antes de dormir si se requiere conveniencia',
    '150 g queso cottage o yogur griego'
  ),
  f(
    'creatine',
    'Creatina monohidrato',
    'Bebidas y suplementos',
    ['creatina', 'suplemento'],
    'g',
    5,
    'per_unit',
    0,
    0,
    0,
    0,
    'Opcional: 5 g diarios con cualquier comida o bebida (no requiere carga)',
    'Opcional · no sustituye alimento'
  ),
  f(
    'soy-milk',
    'Bebida de soya sin azúcar',
    'Bebidas y suplementos',
    ['leche de soya', 'soya', 'bebida vegetal'],
    'ml',
    240,
    'per_100',
    33,
    3.3,
    1.2,
    1.8,
    'Fortificada con calcio y B12 cuando aplique',
    'Leche descremada o yogur vegetal'
  ),
  f(
    'almond-milk',
    'Bebida de almendra sin azúcar',
    'Bebidas y suplementos',
    ['leche de almendra', 'bebida almendra'],
    'ml',
    240,
    'per_100',
    15,
    0.5,
    0.4,
    1.2,
    'Aporte proteico mínimo; usar solo como vehículo líquido',
    'Bebida de soya (aporta más proteína)'
  ),
  f(
    'water',
    'Agua natural / mineral',
    'Bebidas y suplementos',
    ['agua', 'hidratacion'],
    'ml',
    500,
    'per_100',
    0,
    0,
    0,
    0,
    'Meta repartida a lo largo del día',
    'Agua mineral o infusión sin azúcar'
  ),
  f(
    'electrolytes',
    'Bebida isotónica / electrolitos (intra-entreno)',
    'Bebidas y suplementos',
    ['isotonica', 'gatorade', 'electrolitos', 'intra'],
    'ml',
    500,
    'per_100',
    24,
    0,
    6.0,
    0,
    'Útil solo en sesiones >60 min o alta sudoración',
    'Agua + 1 plátano o miel previa si se requieren carbos'
  ),
  f(
    'coffee',
    'Café americano / negro sin azúcar',
    'Bebidas y suplementos',
    ['cafe', 'espresso', 'cafeina'],
    'ml',
    240,
    'per_100',
    2,
    0.2,
    0,
    0,
    'Evitar después de las 17:00 para proteger el sueño',
    'Té verde o infusión sin cafeína por la tarde'
  ),
];

export function normalizeCatalogText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findFoods(query: string, group?: string): CatalogFood[] {
  const q = normalizeCatalogText(query);
  const g = group ? normalizeCatalogText(group) : '';
  return allFoods().filter((food) => {
    if (g && normalizeCatalogText(food.group) !== g) return false;
    if (!q) return true;
    if (normalizeCatalogText(food.name).includes(q)) return true;
    if (normalizeCatalogText(food.group).includes(q)) return true;
    return food.synonyms.some((syn) => normalizeCatalogText(syn).includes(q));
  });
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export function calculateFoodMacros(food: CatalogFood, quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  }
  const factor = food.basis === 'per_100' ? quantity / 100 : quantity;
  return {
    calories: Math.round(food.calories * factor),
    proteinG: round1(food.proteinG * factor),
    carbsG: round1(food.carbsG * factor),
    fatG: round1(food.fatG * factor),
  };
}

export function createItemFromCatalogFood(
  food: CatalogFood,
  quantity?: number
): NutritionItem {
  const qty = quantity ?? food.defaultQuantity;
  const macros = calculateFoodMacros(food, qty);
  return {
    id: crypto.randomUUID(),
    name: food.name,
    quantity: qty,
    unit: food.defaultUnit,
    instructions: food.preparationHint,
    foodGroup: food.group,
    substitutes: food.defaultSubstitutes,
    calories: macros.calories,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
  };
}

export function findCatalogMatch(
  item: Pick<NutritionItem, 'name' | 'unit'>
): CatalogFood | null {
  const normName = normalizeCatalogText(item.name);
  if (!normName) return null;
  const exact = allFoods().find(
    (food) =>
      normalizeCatalogText(food.name) === normName &&
      normalizeCatalogText(food.defaultUnit) === normalizeCatalogText(item.unit)
  );
  return exact ?? null;
}

export interface MacroSummary {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  itemsWithMacros: number;
  totalItems: number;
}

export function summarizeItemsMacros(
  items: readonly NutritionItem[]
): MacroSummary {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let itemsWithMacros = 0;

  for (const item of items) {
    const hasMacros =
      item.calories !== null &&
      item.calories !== undefined &&
      Number.isFinite(item.calories);
    if (hasMacros) {
      itemsWithMacros += 1;
      calories += item.calories ?? 0;
      proteinG += item.proteinG ?? 0;
      carbsG += item.carbsG ?? 0;
      fatG += item.fatG ?? 0;
    }
  }

  return {
    calories: Math.round(calories),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(fatG),
    itemsWithMacros,
    totalItems: items.length,
  };
}

export function summarizeDocumentMacros(doc: NutritionDocument): MacroSummary {
  return summarizeItemsMacros(doc.meals.flatMap((meal) => meal.items));
}

export interface MealTemplate {
  id: string;
  label: string;
  mealName: string;
  category: NutritionMealCategory;
  scheduleTime: string;
  instructions: string;
  items: ReadonlyArray<{ foodId: string; quantity?: number; note?: string }>;
}

export const MEAL_TEMPLATES: readonly MealTemplate[] = [
  {
    id: 'breakfast-eggs-oats',
    label: 'Desayuno proteico (huevos, avena y fruta)',
    mealName: 'Desayuno',
    category: 'breakfast',
    scheduleTime: '08:00',
    instructions:
      'Preparar avena cocida con fresas y huevos al gusto sin exceso de aceite.',
    items: [
      { foodId: 'whole-egg', quantity: 2 },
      { foodId: 'egg-whites', quantity: 100 },
      { foodId: 'oats', quantity: 50 },
      { foodId: 'strawberries', quantity: 120 },
    ],
  },
  {
    id: 'breakfast-yogurt-bowl',
    label: 'Bowl de yogur griego con fruta y almendras',
    mealName: 'Desayuno / Colación',
    category: 'morning_snack',
    scheduleTime: '11:00',
    instructions: 'Mezclar yogur frío con arándanos, chía y almendras.',
    items: [
      { foodId: 'greek-yogurt', quantity: 180 },
      { foodId: 'blueberries', quantity: 80 },
      { foodId: 'almonds', quantity: 15 },
      { foodId: 'chia-seeds', quantity: 1 },
    ],
  },
  {
    id: 'lunch-chicken-rice',
    label: 'Comida completa (pollo, arroz, verduras y aguacate)',
    mealName: 'Comida principal',
    category: 'lunch',
    scheduleTime: '14:00',
    instructions:
      'Pesar el pollo en crudo y el arroz ya cocido; incluir verduras al vapor.',
    items: [
      { foodId: 'chicken-breast', quantity: 160 },
      { foodId: 'white-rice', quantity: 160 },
      { foodId: 'broccoli', quantity: 150 },
      { foodId: 'avocado', quantity: 50 },
    ],
  },
  {
    id: 'pre-workout-light',
    label: 'Pre-entreno ligero (carbos rápidos + proteína magra)',
    mealName: 'Pre-entreno',
    category: 'pre_workout',
    scheduleTime: '16:30',
    instructions:
      'Consumir 60–90 min antes de entrenar para energía disponible sin pesadez.',
    items: [
      { foodId: 'banana', quantity: 1 },
      { foodId: 'rice-cakes', quantity: 3 },
      { foodId: 'whey-protein', quantity: 1 },
    ],
  },
  {
    id: 'post-workout-recovery',
    label: 'Post-entreno de recuperación (carne magra y papa)',
    mealName: 'Post-entreno',
    category: 'post_workout',
    scheduleTime: '19:30',
    instructions:
      'Consumir dentro de las 2 horas posteriores al entrenamiento.',
    items: [
      { foodId: 'lean-beef', quantity: 150 },
      { foodId: 'potato', quantity: 220 },
      { foodId: 'green-beans', quantity: 120 },
    ],
  },
  {
    id: 'dinner-fish-veggies',
    label: 'Cena ligera (pescado blanco, tortillas y ensalada)',
    mealName: 'Cena',
    category: 'dinner',
    scheduleTime: '20:30',
    instructions: 'Cena ligera y rica en proteína con vegetales frescos.',
    items: [
      { foodId: 'white-fish', quantity: 170 },
      { foodId: 'corn-tortilla', quantity: 2 },
      { foodId: 'spinach', quantity: 80 },
      { foodId: 'olive-oil', quantity: 1 },
    ],
  },
  {
    id: 'pre-bed-cottage',
    label: 'Colación nocturna / Pre-cama (digestión lenta)',
    mealName: 'Colación nocturna',
    category: 'pre_bed',
    scheduleTime: '22:00',
    instructions:
      'Proteína de digestión lenta con grasa saludable para sostener el balance nocturno.',
    items: [
      { foodId: 'cottage-cheese', quantity: 150 },
      { foodId: 'walnuts', quantity: 15 },
    ],
  },
];

export function instantiateMealTemplate(template: MealTemplate): NutritionMeal {
  const items: NutritionItem[] = [];
  for (const spec of template.items) {
    const food = FOOD_CATALOG.find((entry) => entry.id === spec.foodId);
    if (!food) continue;
    const item = createItemFromCatalogFood(food, spec.quantity);
    if (spec.note) item.instructions = spec.note;
    items.push(item);
  }
  const summary = summarizeItemsMacros(items);

  return {
    id: crypto.randomUUID(),
    name: template.mealName,
    category: template.category,
    scheduleTime: template.scheduleTime,
    instructions: template.instructions,
    targetCalories: summary.calories > 0 ? summary.calories : null,
    targetProteinG: summary.proteinG > 0 ? Math.round(summary.proteinG) : null,
    targetCarbsG: summary.carbsG > 0 ? Math.round(summary.carbsG) : null,
    targetFatG: summary.fatG > 0 ? Math.round(summary.fatG) : null,
    items,
  };
}
