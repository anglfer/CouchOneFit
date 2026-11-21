import type {
  NutritionActivityLevel,
  NutritionBmrFormula,
  NutritionDayTargets,
  NutritionExperience,
  NutritionGoal,
  NutritionMacroPreference,
  NutritionMealCategory,
  NutritionNeatLevel,
  NutritionPace,
  NutritionPeriWorkout,
  NutritionSex,
  NutritionSuggestedMealTemplate,
  NutritionSuggestionInput,
  NutritionSuggestionResult,
} from '../types/nutrition';

export const ENGINE_VERSION = 'hu025-fitnextfy-v2';

/** Minimum daily average calories in deficit without direct clinical override. */
export const DEFICIT_CALORIE_FLOOR: Record<NutritionSex, number> = {
  male: 1500,
  female: 1200,
};

export const MAX_DEFICIT_PCT = 25;
export const MAX_DEFICIT_PCT_OBESITY = 30;
export const MIN_DAILY_CARBS_G = 50;
const CARBS_ROUNDING_BUFFER_G = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(
  x: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

export function interpolatePiecewise(
  x: number,
  points: [number, number][]
): number {
  if (points.length === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return lerp(x, x0, y0, x1, y1);
  }
  return points[points.length - 1][1];
}

// Standard TDEE factors (1.2 / 1.375 / 1.55 / 1.725 / 1.9); NEAT moves within each band.
const ACTIVITY_RANGES: Record<
  NutritionActivityLevel,
  readonly [number, number]
> = {
  sedentary: [1.2, 1.3],
  light: [1.375, 1.45],
  moderate: [1.55, 1.65],
  very_active: [1.725, 1.9],
};

export function activityMultiplier(
  level: NutritionActivityLevel,
  neat: NutritionNeatLevel
): number {
  const [min, max] = ACTIVITY_RANGES[level];
  if (neat === 'low') return min;
  if (neat === 'high') return max;
  return Number(((min + max) / 2).toFixed(2));
}

export function calculateBmr(
  formula: NutritionBmrFormula,
  sex: NutritionSex,
  weightKg: number,
  heightCm: number,
  ageYears: number,
  bodyFatPct: number | null
): number {
  if (formula === 'katch_mcardle' && bodyFatPct !== null) {
    const lbmKg = weightKg * (1 - bodyFatPct / 100);
    return Math.round(370 + 21.6 * lbmKg);
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function calculateComposition(
  weightKg: number,
  heightCm: number,
  bodyFatPct: number | null
): { leanBodyMassKg: number; leanBodyMassLbs: number; ffmi: number } | null {
  if (bodyFatPct === null) return null;
  const leanBodyMassKg =
    Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10;
  const leanBodyMassLbs = Math.round(leanBodyMassKg * 2.20462 * 10) / 10;
  const meters = heightCm / 100;
  const ffmi =
    meters > 0 ? Math.round((leanBodyMassKg / (meters * meters)) * 10) / 10 : 0;
  return { leanBodyMassKg, leanBodyMassLbs, ffmi };
}

function isObesityRange(sex: NutritionSex, bodyFatPct: number | null): boolean {
  if (bodyFatPct === null) return false;
  return (
    (sex === 'male' && bodyFatPct > 25) || (sex === 'female' && bodyFatPct > 35)
  );
}

export function recommendPhase(
  sex: NutritionSex,
  bodyFatPct: number | null,
  experience: NutritionExperience,
  weightKg: number,
  heightCm: number
): { goal: NutritionGoal; reason: string } | null {
  if (bodyFatPct === null) return null;
  if (isObesityRange(sex, bodyFatPct)) {
    return {
      goal: 'fat_loss',
      reason: `Con ${bodyFatPct}% de grasa corporal estimada, priorizar déficit controlado mejora la sensibilidad a la insulina antes de buscar volumen.`,
    };
  }
  const comp = calculateComposition(weightKg, heightCm, bodyFatPct);
  const bfSkinnyFat =
    sex === 'male'
      ? bodyFatPct > 20 && bodyFatPct <= 25
      : bodyFatPct > 28 && bodyFatPct <= 35;
  const ffmiLow = comp !== null && comp.ffmi < (sex === 'male' ? 19 : 15);
  if (bfSkinnyFat && (ffmiLow || experience === 'beginner')) {
    return {
      goal: 'fat_loss',
      reason:
        'Perfil compatible con bajo desarrollo muscular relativo y grasa media-alta: un déficit moderado inicial suele preparar mejor una fase posterior de recomposición.',
    };
  }
  const bfLow =
    (sex === 'male' && bodyFatPct <= 12) ||
    (sex === 'female' && bodyFatPct <= 22);
  const bfHigh =
    (sex === 'male' && bodyFatPct >= 18) ||
    (sex === 'female' && bodyFatPct >= 28);
  if (bfLow && experience === 'beginner') {
    return {
      goal: 'recomposition',
      reason: `Con ${bodyFatPct}% de grasa y nivel inicial, la recomposición con ligero superávit permite construir masa magra de forma eficiente.`,
    };
  }
  if (bfLow) {
    return {
      goal: 'muscle_gain',
      reason: `Con ${bodyFatPct}% de grasa corporal, existe buen margen para un superávit moderado enfocado en ganancia muscular.`,
    };
  }
  if (bfHigh) {
    return {
      goal: 'fat_loss',
      reason: `Con ${bodyFatPct}% de grasa corporal, un déficit gradual ayuda a reducir tejido adiposo antes de priorizar superávit.`,
    };
  }
  return {
    goal: 'recomposition',
    reason: `Con ${bodyFatPct}% de grasa en rango intermedio, la recomposición en mantenimiento calórico es una estrategia equilibrada.`,
  };
}

function deficitByPace(pace: NutritionPace): number {
  if (pace === 'slow') return -10;
  if (pace === 'fast') return -25;
  return -20;
}

export function calculateCalorieAdjustmentPct(
  sex: NutritionSex,
  bodyFatPct: number | null,
  goal: NutritionGoal,
  experience: NutritionExperience,
  pace: NutritionPace,
  customAdjustmentPct?: number | null
): number {
  if (customAdjustmentPct !== undefined && customAdjustmentPct !== null) {
    return Number(clamp(customAdjustmentPct, -35, 35).toFixed(1));
  }
  if (goal === 'maintenance') return 0;

  if (bodyFatPct === null) {
    if (goal === 'fat_loss')
      return pace === 'slow' ? -10 : pace === 'fast' ? -20 : -15;
    if (goal === 'muscle_gain')
      return pace === 'slow' ? 8 : pace === 'fast' ? 16 : 12;
    return 0;
  }

  if (isObesityRange(sex, bodyFatPct)) {
    if (pace === 'slow') return -20;
    if (pace === 'fast') return -30;
    return -25;
  }

  const bfHighForBulk =
    (sex === 'male' && bodyFatPct >= 18) ||
    (sex === 'female' && bodyFatPct >= 28);
  if (goal === 'muscle_gain' && bfHighForBulk) return deficitByPace(pace);
  if (goal === 'recomposition' && bfHighForBulk) {
    return pace === 'slow' ? -10 : pace === 'fast' ? -20 : -15;
  }

  const bfLow =
    (sex === 'male' && bodyFatPct <= 12) ||
    (sex === 'female' && bodyFatPct <= 22);
  const slight = (base: number) =>
    pace === 'slow' ? base - 2.5 : pace === 'fast' ? base + 2.5 : base;

  if (goal === 'fat_loss') {
    return bfLow ? -slight(7.5) : deficitByPace(pace);
  }
  if (goal === 'muscle_gain' && !bfLow) {
    const base =
      experience === 'beginner' ? 10 : experience === 'intermediate' ? 7.5 : 5;
    return slight(base);
  }
  if (goal === 'muscle_gain') {
    if (experience === 'beginner') return pace === 'slow' ? 20 : 25;
    if (experience === 'intermediate')
      return pace === 'slow' ? 15 : pace === 'fast' ? 20 : 17.5;
    return pace === 'slow' ? 10 : pace === 'fast' ? 15 : 12.5;
  }

  if (bfLow) {
    let base =
      experience === 'beginner' ? 20 : experience === 'intermediate' ? 15 : 10;
    if (pace === 'slow') base = Math.max(base - 5, 5);
    if (pace === 'fast') base = Math.min(base + 5, 25);
    return base;
  }
  if (experience === 'advanced') {
    const priority =
      pace === 'slow'
        ? 'fat'
        : pace === 'fast'
          ? 'muscle'
          : bodyFatPct >= (sex === 'male' ? 15 : 25)
            ? 'fat'
            : 'muscle';
    return priority === 'fat' ? -7.5 : 7.5;
  }
  return 0;
}

const PROTEIN_POINTS_MALE: [number, number][] = [
  [8, 1.6],
  [10, 1.5],
  [14, 1.4],
  [18, 1.35],
  [30, 1.2],
];

const PROTEIN_POINTS_FEMALE: [number, number][] = [
  [18, 1.6],
  [22, 1.5],
  [25, 1.35],
  [35, 1.35],
  [40, 1.2],
];

export function calculateProteinGrams(
  sex: NutritionSex,
  weightKg: number,
  bodyFatPct: number | null,
  goal: NutritionGoal,
  customProteinPerKg?: number | null
): number {
  if (customProteinPerKg !== undefined && customProteinPerKg !== null) {
    return Math.max(30, Math.round(weightKg * customProteinPerKg));
  }
  if (bodyFatPct !== null) {
    const lbmLbs = weightKg * 2.20462 * (1 - bodyFatPct / 100);
    const points = sex === 'male' ? PROTEIN_POINTS_MALE : PROTEIN_POINTS_FEMALE;
    const factor = clamp(
      Number(interpolatePiecewise(bodyFatPct, points).toFixed(3)),
      1.2,
      1.6
    );
    return Math.max(30, Math.round(lbmLbs * factor));
  }
  const factorPerKg =
    goal === 'fat_loss'
      ? 2.0
      : goal === 'recomposition'
        ? 1.9
        : goal === 'muscle_gain'
          ? 1.8
          : 1.6;
  return Math.max(30, Math.round(weightKg * factorPerKg));
}

const FAT_POINTS_MALE: [number, number][] = [
  [8, 20],
  [10, 23],
  [14, 25],
  [16, 27],
  [25, 35],
];

const FAT_POINTS_FEMALE: [number, number][] = [
  [18, 20],
  [22, 25],
  [25, 25],
  [28, 27],
  [35, 30],
  [40, 35],
];

function calculateTargetFatPct(
  sex: NutritionSex,
  bodyFatPct: number | null,
  preference: NutritionMacroPreference,
  activityLevel: NutritionActivityLevel,
  neatLevel: NutritionNeatLevel
): number {
  const referenceBf = bodyFatPct ?? (sex === 'male' ? 16 : 26);
  const points = sex === 'male' ? FAT_POINTS_MALE : FAT_POINTS_FEMALE;
  let pct = interpolatePiecewise(referenceBf, points);

  if (preference === 'higher_fat') pct += 2;
  if (preference === 'higher_carbs') pct -= 2;

  if (activityLevel === 'sedentary' && neatLevel === 'low') pct += 3;
  if (activityLevel === 'light' && neatLevel === 'low') pct += 1;
  if (activityLevel === 'moderate' && neatLevel === 'high') pct -= 1;
  if (activityLevel === 'very_active' && neatLevel === 'high') pct -= 3;

  return clamp(Math.round(pct), 20, 35);
}

export function limitDeficitSafety(
  sex: NutritionSex,
  bodyFatPct: number | null,
  tdee: number,
  requestedCalories: number,
  proteinG: number,
  carbCycling: boolean
): {
  calories: number;
  status: 'ok' | 'limited' | 'review_required';
  notice: string | null;
} {
  if (!(requestedCalories < tdee)) {
    return { calories: requestedCalories, status: 'ok', notice: null };
  }
  const obese = isObesityRange(sex, bodyFatPct);
  const maxDeficitPct = obese ? MAX_DEFICIT_PCT_OBESITY : MAX_DEFICIT_PCT;
  const baseCarbs =
    (carbCycling ? MIN_DAILY_CARBS_G / 0.8 : MIN_DAILY_CARBS_G) +
    CARBS_ROUNDING_BUFFER_G;
  const minForMacros = Math.ceil((proteinG * 4 + baseCarbs * 4) / 0.8);
  const floor = Math.max(
    DEFICIT_CALORIE_FLOOR[sex],
    Math.round(tdee * (1 - maxDeficitPct / 100)),
    minForMacros
  );

  if (floor >= tdee) {
    return {
      calories: Math.round(tdee),
      status: 'review_required',
      notice: `Con el perfil indicado no cabe un déficit automático seguro debajo del mantenimiento (${Math.round(tdee)} kcal): el piso de seguridad es ${floor} kcal/día. La sugerencia se fijó en mantenimiento para revisión profesional.`,
    };
  }
  if (requestedCalories < floor) {
    return {
      calories: floor,
      status: 'limited',
      notice: `El déficit sugerido se acotó al piso de seguridad (${floor} kcal/día: mínimo ${DEFICIT_CALORIE_FLOOR[sex]} kcal, déficit máx. ${maxDeficitPct}% y ≥${MIN_DAILY_CARBS_G} g de carbohidratos). Puedes ajustarlo manualmente si el criterio clínico lo requiere.`,
    };
  }
  return { calories: requestedCalories, status: 'ok', notice: null };
}

function capFatPctForMinCarbs(
  calories: number,
  proteinG: number,
  fatPct: number,
  carbCycling: boolean
): number {
  const baseCarbs =
    (carbCycling ? MIN_DAILY_CARBS_G / 0.8 : MIN_DAILY_CARBS_G) +
    CARBS_ROUNDING_BUFFER_G;
  const maxFatPct = Math.floor(
    ((calories - proteinG * 4 - baseCarbs * 4) / calories) * 100
  );
  return Math.max(20, Math.min(fatPct, maxFatPct));
}

export function allocateMacrosSafely(
  requestedCalories: number,
  requestedProteinG: number,
  requestedFatPct: number
): NutritionDayTargets {
  const caloriesTarget = Math.max(1, Math.round(requestedCalories));
  const proteinG = Math.max(1, Math.round(requestedProteinG));
  const proteinKcal = proteinG * 4;
  const fatPct = clamp(requestedFatPct, 20, 35);
  const minFatG = Math.ceil(proteinKcal / 36);
  const minSafeKcal = proteinKcal + minFatG * 9;
  const targetKcal =
    caloriesTarget < minSafeKcal ? minSafeKcal : caloriesTarget;

  if (caloriesTarget < minSafeKcal) {
    return {
      caloriesTarget: minSafeKcal,
      proteinTargetG: proteinG,
      carbsTargetG: 0,
      fatTargetG: minFatG,
    };
  }

  const idealFatG = Math.min(
    Math.round((targetKcal * fatPct) / 900),
    Math.floor((targetKcal - proteinKcal) / 9)
  );

  const buildCandidates = (clampCarbs: boolean) =>
    [-2, -1, 0, 1, 2]
      .map((delta) => idealFatG + delta)
      .filter((fatG) => fatG >= 0 && fatG * 9 + proteinKcal <= targetKcal)
      .map((fatG) => {
        const rawCarbsG = Math.max(
          0,
          Math.round((targetKcal - proteinKcal - fatG * 9) / 4)
        );
        const maxCarbs = Math.floor(
          ((fatG * 9) / 0.2 - proteinKcal - fatG * 9) / 4
        );
        const minCarbs = Math.ceil(
          ((fatG * 9) / 0.35 - proteinKcal - fatG * 9) / 4
        );
        const carbsG = clampCarbs
          ? Math.max(0, minCarbs, Math.min(maxCarbs, rawCarbsG))
          : rawCarbsG;
        const calories = proteinKcal + fatG * 9 + carbsG * 4;
        return { fatG, carbsG, calories };
      })
      .filter(({ fatG, calories }) => {
        const pct = (fatG * 9) / calories;
        return pct >= 0.2 && pct <= 0.35;
      })
      .sort(
        (a, b) =>
          Math.abs(a.fatG - idealFatG) - Math.abs(b.fatG - idealFatG) ||
          Math.abs(a.calories - targetKcal) - Math.abs(b.calories - targetKcal)
      );

  const best = buildCandidates(false)[0] ?? buildCandidates(true)[0];
  if (!best) {
    const fallbackFat = Math.max(
      minFatG,
      Math.floor((targetKcal - proteinKcal) / 9)
    );
    const fallbackCarbs = Math.max(
      0,
      Math.round((targetKcal - proteinKcal - fallbackFat * 9) / 4)
    );
    return {
      caloriesTarget: proteinKcal + fallbackFat * 9 + fallbackCarbs * 4,
      proteinTargetG: proteinG,
      carbsTargetG: fallbackCarbs,
      fatTargetG: fallbackFat,
    };
  }

  return {
    caloriesTarget: best.calories,
    proteinTargetG: proteinG,
    carbsTargetG: best.carbsG,
    fatTargetG: best.fatG,
  };
}

function adjustFatForFixedMacros(
  proteinG: number,
  baseFatG: number,
  carbsG: number
): number {
  const noFatKcal = (proteinG + carbsG) * 4;
  const minFat = Math.ceil(noFatKcal / 36);
  const maxFat = Math.floor((noFatKcal * 7) / 117);
  if (minFat > maxFat) return Math.max(0, Math.round(baseFatG));
  return Math.min(maxFat, Math.max(minFat, Math.round(baseFatG)));
}

export function splitCarbCycling(
  base: NutritionDayTargets,
  trainingDaysPerWeek: number
): { training: NutritionDayTargets; rest: NutritionDayTargets } {
  const trainDays = clamp(Math.round(trainingDaysPerWeek), 1, 6);
  const restDays = 7 - trainDays;
  const p = base.proteinTargetG;
  const restCarbs = Math.round(
    ((base.carbsTargetG * 7) / (trainDays + 0.8 * restDays)) * 0.8
  );
  const restFat = adjustFatForFixedMacros(p, base.fatTargetG, restCarbs);
  const restKcal = p * 4 + restFat * 9 + restCarbs * 4;

  const totalWeeklyKcal =
    7 * (p * 4 + base.fatTargetG * 9 + base.carbsTargetG * 4);
  const trainTargetKcal = (totalWeeklyKcal - restDays * restKcal) / trainDays;
  const carbsForFat = (fatG: number) =>
    Math.max(0, Math.round((trainTargetKcal - p * 4 - fatG * 9) / 4));
  const trainFat = adjustFatForFixedMacros(
    p,
    base.fatTargetG,
    carbsForFat(base.fatTargetG)
  );
  const trainCarbs = carbsForFat(trainFat);
  const trainKcal = p * 4 + trainFat * 9 + trainCarbs * 4;

  return {
    training: {
      caloriesTarget: trainKcal,
      proteinTargetG: p,
      carbsTargetG: trainCarbs,
      fatTargetG: trainFat,
    },
    rest: {
      caloriesTarget: restKcal,
      proteinTargetG: p,
      carbsTargetG: restCarbs,
      fatTargetG: restFat,
    },
  };
}

export function calculateFiberTargetG(carbsG: number): number {
  if (carbsG < 200) return 25;
  const points: [number, number][] = [
    [200, 35],
    [300, 45],
    [400, 55],
    [500, 65],
    [600, 75],
  ];
  return Math.round(clamp(interpolatePiecewise(carbsG, points), 25, 75));
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function calculateMealDistribution(
  proteinG: number,
  goal: NutritionGoal,
  experience: NutritionExperience,
  weightKg: number,
  restrictions: readonly string[]
) {
  let mealsPerDay: number;
  if (experience === 'beginner') {
    mealsPerDay = 4;
  } else if (experience === 'advanced' && goal === 'muscle_gain') {
    mealsPerDay = 6;
  } else if (goal === 'fat_loss') {
    mealsPerDay = 5;
  } else {
    mealsPerDay = experience === 'advanced' ? 5 : 4;
  }

  const proteinPerMealG = Math.round(proteinG / mealsPerDay);
  const intervalHours = mealsPerDay <= 4 ? '4–5 horas' : '3–4 horas';
  const leucineThresholdG = Math.round(0.045 * weightKg * 10) / 10;

  const normalized = restrictions.map(normalizeText);
  const isVeganOrVeg = normalized.some(
    (r) => r.includes('vegan') || r.includes('vegetari')
  );
  const dairyFree = normalized.some(
    (r) => r.includes('lacte') || r.includes('lactosa') || r.includes('leche')
  );

  const leucineNote = isVeganOrVeg
    ? `Umbral orientativo de leucina: ~${leucineThresholdG} g por comida (0.045 g/kg). Combina fuentes vegetales complementarias o mezcla de proteína de arroz/guisante.`
    : `Umbral orientativo de leucina: ~${leucineThresholdG} g por comida (0.045 g/kg). Reparte la proteína de forma homogénea priorizando fuentes de alto valor biológico.`;

  const preBedSources = isVeganOrVeg
    ? [
        'Tofu firme o tempeh',
        'Proteína vegetal (soya / arroz + guisante)',
        'Yogur vegetal alto en proteína con chía',
      ]
    : dairyFree
      ? ['Carne magra o pollo', 'Huevo entero', 'Proteína vegetal combinada']
      : ['Queso cottage o requesón', 'Yogur griego natural', 'Caseína micelar'];

  return {
    mealsPerDay,
    proteinPerMealG,
    intervalHours,
    leucineThresholdG,
    leucineNote,
    preBedProteinG: proteinPerMealG,
    preBedSources,
    preBedNote:
      'Incluir proteína de digestión lenta antes de dormir (combinada con algo de fibra o grasa saludable) ayuda a sostener el balance proteico nocturno.',
  };
}

export function calculatePeriWorkoutTargets(
  weightKg: number,
  bodyFatPct: number | null,
  sex: NutritionSex,
  sessionDurationMin: number,
  trainingDaysPerWeek: number,
  dailyMacros: { carbsG: number; proteinG: number },
  inDeficit: boolean
): NutritionPeriWorkout {
  let preCarbsG = Math.round(weightKg * 1.0);
  const refBf = bodyFatPct ?? (sex === 'male' ? 16 : 26);
  const preProtPoints: [number, number][] =
    sex === 'female'
      ? [
          [18, 0.75],
          [25, 0.6],
          [35, 0.45],
          [45, 0.45],
        ]
      : [
          [8, 0.75],
          [15, 0.6],
          [25, 0.45],
          [40, 0.45],
        ];
  let preProteinG = Math.round(
    clamp(
      interpolatePiecewise(refBf, preProtPoints) * weightKg,
      Math.max(20, Math.round(weightKg * 0.45)),
      Math.max(20, Math.round(weightKg * 0.75))
    )
  );
  const preFatG = 10;

  let postProteinG = Math.round(clamp(weightKg * 0.5, 20, weightKg * 0.75));
  let postCarbsG = Math.round(
    weightKg * (trainingDaysPerWeek >= 5 ? 1.5 : 1.25)
  );
  const postFatG = 10;

  const requiresIntra = sessionDurationMin > 60;
  let intraCarbsG = requiresIntra
    ? Math.round(0.5 * Math.max(20, sessionDurationMin - 30))
    : 0;
  if (inDeficit && intraCarbsG > 0) {
    intraCarbsG = clamp(intraCarbsG, 5, 10);
  }

  const carbsCap = Math.max(0, Math.floor(dailyMacros.carbsG));
  const totalCarbs = preCarbsG + intraCarbsG + postCarbsG;
  if (totalCarbs > carbsCap && totalCarbs > 0) {
    const factor = carbsCap / totalCarbs;
    preCarbsG = Math.floor(preCarbsG * factor);
    intraCarbsG = Math.floor(intraCarbsG * factor);
    postCarbsG = Math.max(0, carbsCap - preCarbsG - intraCarbsG);
  }

  const protCap = Math.max(0, Math.floor(dailyMacros.proteinG));
  const totalProt = preProteinG + postProteinG;
  if (totalProt > protCap && totalProt > 0) {
    const factor = protCap / totalProt;
    preProteinG = Math.floor(preProteinG * factor);
    postProteinG = Math.max(0, protCap - preProteinG);
  }

  return {
    preCarbsG,
    preProteinG,
    preFatG,
    postCarbsG,
    postProteinG,
    postFatG,
    intraCarbsG,
    notes:
      'Pre-entreno 60–90 min antes con digestión ligera. Post-entreno dentro de las 2 h posteriores; ambos forman parte del total diario.',
  };
}

function buildSuggestedMeals(
  targets: NutritionDayTargets,
  mealsPerDay: number,
  peri: NutritionPeriWorkout
): NutritionSuggestedMealTemplate[] {
  const templates: Array<{
    name: string;
    category: NutritionMealCategory;
    scheduleTime: string;
    pShare: number;
    cShare: number;
    fShare: number;
    instructions: string;
  }> =
    mealsPerDay >= 5
      ? [
          {
            name: 'Desayuno',
            category: 'breakfast',
            scheduleTime: '08:00',
            pShare: 0.2,
            cShare: 0.25,
            fShare: 0.25,
            instructions:
              'Base proteica completa con carbohidrato complejo y fruta para iniciar el día.',
          },
          {
            name: 'Comida principal',
            category: 'lunch',
            scheduleTime: '13:30',
            pShare: 0.22,
            cShare: 0.25,
            fShare: 0.3,
            instructions:
              'Incluye proteína magra, 1–2 porciones de verdura verde y carbohidrato principal.',
          },
          {
            name: 'Pre-entreno',
            category: 'pre_workout',
            scheduleTime: '16:30',
            pShare: 0.18,
            cShare: 0.25,
            fShare: 0.1,
            instructions: `Objetivo guía ~${peri.preProteinG} g proteína y ~${peri.preCarbsG} g carbos de fácil digestión 60–90 min antes de entrenar.`,
          },
          {
            name: 'Post-entreno / Cena',
            category: 'post_workout',
            scheduleTime: '19:30',
            pShare: 0.22,
            cShare: 0.2,
            fShare: 0.2,
            instructions: `Objetivo guía ~${peri.postProteinG} g proteína y ~${peri.postCarbsG} g carbos para recuperación muscular.`,
          },
          {
            name: 'Colación nocturna',
            category: 'pre_bed',
            scheduleTime: '22:00',
            pShare: 0.18,
            cShare: 0.05,
            fShare: 0.15,
            instructions:
              'Proteína de digestión lenta (yogur griego, cottage o equivalente) con algo de fibra o grasa saludable.',
          },
        ]
      : [
          {
            name: 'Desayuno',
            category: 'breakfast',
            scheduleTime: '08:00',
            pShare: 0.25,
            cShare: 0.25,
            fShare: 0.3,
            instructions:
              'Prioriza proteína de alta calidad + carbohidratos integrales + fruta.',
          },
          {
            name: 'Comida principal',
            category: 'lunch',
            scheduleTime: '14:00',
            pShare: 0.25,
            cShare: 0.3,
            fShare: 0.3,
            instructions:
              'Incluye proteína magra, vegetales variados y grasa saludable medida.',
          },
          {
            name: 'Merienda / Pre-entreno',
            category: 'pre_workout',
            scheduleTime: '17:30',
            pShare: 0.22,
            cShare: 0.25,
            fShare: 0.15,
            instructions: `Comida ligera 60–90 min antes de entrenar (~${peri.preProteinG} g prot / ~${peri.preCarbsG} g carbos).`,
          },
          {
            name: 'Cena / Recuperación',
            category: 'dinner',
            scheduleTime: '20:30',
            pShare: 0.28,
            cShare: 0.2,
            fShare: 0.25,
            instructions:
              'Completa el requerimiento diario de proteína y verduras verdes.',
          },
        ];

  let remainingP = targets.proteinTargetG;
  let remainingC = targets.carbsTargetG;
  let remainingF = targets.fatTargetG;

  return templates.map((t, index) => {
    const isLast = index === templates.length - 1;
    const p = isLast
      ? Math.max(0, remainingP)
      : Math.round(targets.proteinTargetG * t.pShare);
    const c = isLast
      ? Math.max(0, remainingC)
      : Math.round(targets.carbsTargetG * t.cShare);
    const f = isLast
      ? Math.max(0, remainingF)
      : Math.round(targets.fatTargetG * t.fShare);
    remainingP -= p;
    remainingC -= c;
    remainingF -= f;

    return {
      name: t.name,
      category: t.category,
      scheduleTime: t.scheduleTime,
      targetProteinG: p,
      targetCarbsG: c,
      targetFatG: f,
      targetCalories: p * 4 + c * 4 + f * 9,
      instructions: t.instructions,
    };
  });
}

export function generateNutritionSuggestion(
  input: NutritionSuggestionInput,
  now: Date = new Date()
): NutritionSuggestionResult {
  const formulaUsed: NutritionBmrFormula =
    input.formula === 'katch_mcardle' && input.bodyFatPct !== null
      ? 'katch_mcardle'
      : 'mifflin';
  const bmr = calculateBmr(
    formulaUsed,
    input.sex,
    input.weightKg,
    input.heightCm,
    input.ageYears,
    input.bodyFatPct
  );
  const mult = activityMultiplier(input.activityLevel, input.neatLevel);
  const tdee = Math.round(bmr * mult);
  const composition = calculateComposition(
    input.weightKg,
    input.heightCm,
    input.bodyFatPct
  );
  const recommendedPhase = recommendPhase(
    input.sex,
    input.bodyFatPct,
    input.experience,
    input.weightKg,
    input.heightCm
  );

  let adjustmentPct = calculateCalorieAdjustmentPct(
    input.sex,
    input.bodyFatPct,
    input.goal,
    input.experience,
    input.pace,
    input.customAdjustmentPct
  );

  const proteinG = calculateProteinGrams(
    input.sex,
    input.weightKg,
    input.bodyFatPct,
    input.goal,
    input.customProteinPerKg
  );

  const requestedCalories = Math.round(tdee * (1 + adjustmentPct / 100));
  const useCycling = input.enableCarbCycling && input.trainingDaysPerWeek < 7;

  const safety = limitDeficitSafety(
    input.sex,
    input.bodyFatPct,
    tdee,
    requestedCalories,
    proteinG,
    useCycling
  );

  if (safety.status !== 'ok') {
    adjustmentPct = Number(((safety.calories / tdee - 1) * 100).toFixed(1));
  }

  const baseFatPct = calculateTargetFatPct(
    input.sex,
    input.bodyFatPct,
    input.macroPreference,
    input.activityLevel,
    input.neatLevel
  );
  const effectiveFatPct = capFatPctForMinCarbs(
    safety.calories,
    proteinG,
    baseFatPct,
    useCycling
  );
  const baseTargets = allocateMacrosSafely(
    safety.calories,
    proteinG,
    effectiveFatPct
  );

  const cycled = useCycling
    ? splitCarbCycling(baseTargets, input.trainingDaysPerWeek)
    : null;
  const trainingDayTargets = cycled ? cycled.training : baseTargets;
  const restDayTargets = cycled ? cycled.rest : null;

  const trainDays = clamp(Math.round(input.trainingDaysPerWeek), 1, 7);
  const weeklyAverageCalories = restDayTargets
    ? Math.round(
        (trainingDayTargets.caloriesTarget * trainDays +
          restDayTargets.caloriesTarget * (7 - trainDays)) /
          7
      )
    : trainingDayTargets.caloriesTarget;

  const fiberTargetG = calculateFiberTargetG(trainingDayTargets.carbsTargetG);
  const fiberContextualG = Math.round(
    (trainingDayTargets.caloriesTarget / 1000) * 14
  );
  const hydrationTargetMl = trainingDayTargets.caloriesTarget;
  const hydrationRef =
    input.sex === 'male'
      ? { total: 3700, beverages: 3000 }
      : { total: 2700, beverages: 2200 };

  const mealDistribution = calculateMealDistribution(
    trainingDayTargets.proteinTargetG,
    input.goal,
    input.experience,
    input.weightKg,
    input.restrictions
  );

  const periWorkout = calculatePeriWorkoutTargets(
    input.weightKg,
    input.bodyFatPct,
    input.sex,
    input.sessionDurationMin,
    input.trainingDaysPerWeek,
    {
      carbsG: trainingDayTargets.carbsTargetG,
      proteinG: trainingDayTargets.proteinTargetG,
    },
    adjustmentPct < 0
  );

  const hydrationPeriWorkout = {
    preMinMl: Math.round(input.weightKg * 5),
    preMaxMl: Math.round(input.weightKg * 10),
    intraMinMl: Math.round(400 * (input.sessionDurationMin / 60)),
    intraMaxMl: Math.round(800 * (input.sessionDurationMin / 60)),
    postPerKgMinMl: 1250,
    postPerKgMaxMl: 1500,
  };

  const suggestedMeals = buildSuggestedMeals(
    trainingDayTargets,
    mealDistribution.mealsPerDay,
    periWorkout
  );

  const generalGuidanceSummary = [
    'Regla 80/20: prioriza ~80% de alimentos enteros y mínimamente procesados; deja ~20% flexible para sostener adherencia.',
    `Fibra orientativa: ~${fiberTargetG} g/día (aumentar de forma gradual). Hidratación base ~${(hydrationTargetMl / 1000).toFixed(1)} L/día más reposición por sudoración.`,
    `Distribución sugerida: ${mealDistribution.mealsPerDay} comidas cada ${mealDistribution.intervalHours} (~${mealDistribution.proteinPerMealG} g de proteína/comida).`,
  ].join(' ');

  const generatedAt = now.toISOString();

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt,
    formulaUsed,
    bmr,
    activityMultiplier: mult,
    tdee,
    leanBodyMassKg: composition?.leanBodyMassKg ?? null,
    leanBodyMassLbs: composition?.leanBodyMassLbs ?? null,
    ffmi: composition?.ffmi ?? null,
    recommendedPhase,
    adjustmentPct,
    safetyStatus: safety.status,
    safetyNotice: safety.notice,
    trainingDayTargets,
    restDayTargets,
    weeklyAverageCalories,
    proteinPerKg:
      Math.round((trainingDayTargets.proteinTargetG / input.weightKg) * 100) /
      100,
    fatPercentage: Math.round(
      ((trainingDayTargets.fatTargetG * 9) /
        trainingDayTargets.caloriesTarget) *
        100
    ),
    fiberTargetG,
    fiberContextualG,
    hydrationTargetMl,
    hydrationReferenceTotalMl: hydrationRef.total,
    hydrationReferenceBeveragesMl: hydrationRef.beverages,
    mealDistribution,
    periWorkout,
    hydrationPeriWorkout,
    generalGuidanceSummary,
    suggestedMeals,
    meta: {
      engineVersion: ENGINE_VERSION,
      formula: formulaUsed,
      goal: input.goal,
      pace: input.pace,
      bmr,
      tdee,
      adjustmentPct,
      baselineWeightKg: input.weightKg,
      baselineBodyFatPct: input.bodyFatPct,
      generatedAt,
      modifiedByProfessional: false,
      restrictions: input.restrictions,
    },
  };
}
