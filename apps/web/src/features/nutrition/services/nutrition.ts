import { sessionMutation, sessionRequest } from '../../auth/services/session';
import { isConnectionFailure } from '../../../services/offline/connection';
import {
  enqueue,
  getOperations,
  updateOperation,
  type OperationSpec,
} from '../../../services/offline/outbox';
import { flushOutbox } from '../../../services/offline/sync';
import { generateNutritionSuggestion } from '../utils/suggestionEngine';
import type {
  NutritionDayTargets,
  NutritionDocument,
  NutritionItem,
  NutritionItemKind,
  NutritionMeal,
  NutritionMealCategory,
  NutritionPeriWorkout,
  NutritionSuggestionInput,
  NutritionSuggestionMeta,
  NutritionSuggestionResult,
  NutritionVersion,
  NutritionVersionsResponse,
} from '../types/nutrition';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isNullableNumber = (v: unknown) =>
  v === undefined || v === null || typeof v === 'number';
const isNullableString = (v: unknown) =>
  v === undefined || v === null || typeof v === 'string';

const isDayTargets = (
  v: unknown
): v is NutritionDayTargets | null | undefined =>
  v === undefined ||
  v === null ||
  (isRecord(v) &&
    typeof v.caloriesTarget === 'number' &&
    typeof v.proteinTargetG === 'number' &&
    typeof v.carbsTargetG === 'number' &&
    typeof v.fatTargetG === 'number');

const isPeriWorkout = (
  v: unknown
): v is NutritionPeriWorkout | null | undefined =>
  v === undefined ||
  v === null ||
  (isRecord(v) &&
    typeof v.preCarbsG === 'number' &&
    typeof v.preProteinG === 'number' &&
    typeof v.preFatG === 'number' &&
    typeof v.postCarbsG === 'number' &&
    typeof v.postProteinG === 'number' &&
    typeof v.postFatG === 'number' &&
    typeof v.intraCarbsG === 'number' &&
    isNullableString(v.notes));

const isSuggestionMeta = (
  v: unknown
): v is NutritionSuggestionMeta | null | undefined =>
  v === undefined ||
  v === null ||
  (isRecord(v) &&
    typeof v.engineVersion === 'string' &&
    typeof v.formula === 'string' &&
    typeof v.goal === 'string' &&
    typeof v.pace === 'string' &&
    typeof v.bmr === 'number' &&
    typeof v.tdee === 'number' &&
    typeof v.adjustmentPct === 'number' &&
    typeof v.baselineWeightKg === 'number' &&
    isNullableNumber(v.baselineBodyFatPct) &&
    typeof v.generatedAt === 'string' &&
    typeof v.modifiedByProfessional === 'boolean');

const isRecipeIngredient = (v: unknown): boolean =>
  isRecord(v) &&
  typeof v.name === 'string' &&
  typeof v.quantity === 'number' &&
  typeof v.unit === 'string';

const isNullableRecipeIngredients = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (Array.isArray(v) && v.every(isRecipeIngredient));

const isNullableItemKind = (v: unknown): boolean =>
  v === undefined || v === null || v === 'food' || v === 'recipe';

export function isNutritionVersion(v: unknown): v is NutritionVersion {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.planId === 'string' &&
    (v.clientId === null || typeof v.clientId === 'string') &&
    Number.isInteger(v.number) &&
    Number.isInteger(v.revision) &&
    typeof v.published === 'boolean' &&
    typeof v.createdAt === 'string' &&
    typeof v.name === 'string' &&
    isNullableNumber(v.caloriesTarget) &&
    isNullableNumber(v.proteinTargetG) &&
    isNullableNumber(v.carbsTargetG) &&
    isNullableNumber(v.fatTargetG) &&
    isNullableString(v.generalInstructions) &&
    isNullableNumber(v.fiberTargetG) &&
    isNullableNumber(v.hydrationTargetMl) &&
    isDayTargets(v.restDayTargets) &&
    isPeriWorkout(v.periWorkout) &&
    isSuggestionMeta(v.suggestionMeta) &&
    Array.isArray(v.meals) &&
    v.meals.every(
      (m) =>
        isRecord(m) &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        isNullableString(m.instructions) &&
        isNullableString(m.scheduleTime) &&
        isNullableString(m.category) &&
        isNullableNumber(m.targetCalories) &&
        isNullableNumber(m.targetProteinG) &&
        isNullableNumber(m.targetCarbsG) &&
        isNullableNumber(m.targetFatG) &&
        Array.isArray(m.items) &&
        m.items.every(
          (i) =>
            isRecord(i) &&
            typeof i.id === 'string' &&
            typeof i.name === 'string' &&
            typeof i.quantity === 'number' &&
            typeof i.unit === 'string' &&
            isNullableString(i.instructions) &&
            isNullableItemKind(i.kind) &&
            isNullableRecipeIngredients(i.recipeIngredients) &&
            isNullableString(i.foodGroup) &&
            isNullableString(i.substitutes) &&
            isNullableNumber(i.calories) &&
            isNullableNumber(i.proteinG) &&
            isNullableNumber(i.carbsG) &&
            isNullableNumber(i.fatG)
        )
    )
  );
}

export async function readNutritionVersions(
  clientId: string
): Promise<NutritionVersionsResponse> {
  const value = await sessionRequest<unknown>(
    `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans`
  );
  if (
    !isRecord(value) ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isNutritionVersion) ||
    (value.activeVersionId !== null &&
      typeof value.activeVersionId !== 'string') ||
    typeof value.activeRevision !== 'number' ||
    typeof value.canWrite !== 'boolean'
  ) {
    throw new Error('No pudimos interpretar los planes alimenticios.');
  }
  return value as unknown as NutritionVersionsResponse;
}

export async function requestNutritionSuggestion(
  clientId: string,
  input: NutritionSuggestionInput
): Promise<NutritionSuggestionResult> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans/suggestion`;
  try {
    const response = await sessionMutation<unknown>(endpoint, input, 'POST');
    if (!isRecord(response) || !isRecord(response.suggestion)) {
      throw new Error('No pudimos interpretar la sugerencia nutricional.');
    }
    return response.suggestion as unknown as NutritionSuggestionResult;
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return generateNutritionSuggestion(input);
  }
}

const NUTRITION_DOCUMENT_KEYS = [
  'name',
  'meals',
  'caloriesTarget',
  'proteinTargetG',
  'carbsTargetG',
  'fatTargetG',
  'generalInstructions',
  'fiberTargetG',
  'hydrationTargetMl',
  'restDayTargets',
  'periWorkout',
  'suggestionMeta',
] as const;

function mergeNutritionBody(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>,
  method: 'POST' | 'PATCH'
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...previous };
  for (const key of NUTRITION_DOCUMENT_KEYS) {
    if (key in incoming) next[key] = incoming[key];
  }
  if (method === 'POST') delete next.revision;
  return next;
}

export async function nutritionWrite(
  spec: Omit<OperationSpec, 'id'>
): Promise<{ queued: boolean; result?: unknown }> {
  const related = getOperations().filter(
    (op) => op.entityKey === spec.entityKey
  );
  if (related.some((op) => op.state === 'failed' || op.state === 'conflict')) {
    throw new Error(
      'Este plan nutricional tiene un cambio sin enviar que necesita tu decisión. Resuélvelo en «Pendientes de enviar»; tu captura sigue aquí.'
    );
  }
  if (
    spec.kind === 'nutrition.activate' &&
    related.some((op) => op.kind === spec.kind && op.endpoint === spec.endpoint)
  ) {
    throw new Error(
      'Ya hay una activación igual pendiente de enviar. Revísala en «Pendientes de enviar».'
    );
  }
  const last = related.at(-1);
  if (
    last &&
    last.state === 'pending' &&
    last.attempts === 0 &&
    last.kind === 'nutrition.save' &&
    spec.kind === 'nutrition.save'
  ) {
    await updateOperation(last.id, {
      body: mergeNutritionBody(last.body, spec.body, last.method),
      label: spec.label,
    });
    return { queued: true };
  }
  const id = crypto.randomUUID();
  const dependencies = related.map((op) => op.id);
  if (!dependencies.length && navigator.onLine !== false) {
    try {
      return {
        queued: false,
        result: await sessionMutation(spec.endpoint, spec.body, spec.method, {
          'Idempotency-Key': id,
        }),
      };
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
      const operation = await enqueue({ ...spec, id, dependsOn: dependencies });
      if (!operation) throw error;
      await updateOperation(id, { attempts: 1 });
      return { queued: true };
    }
  }
  const operation = await enqueue({ ...spec, id, dependsOn: dependencies });
  if (!operation) {
    throw new Error('No pudimos guardar el cambio en este dispositivo.');
  }
  if (navigator.onLine !== false) void flushOutbox();
  return { queued: true };
}

export async function saveNutritionDraftOffline(params: {
  clientId: string;
  clientName: string;
  planId?: string;
  provisionalPlanId?: string;
  versionId?: string;
  provisionalVersionId?: string;
  revision?: number;
  document: NutritionDocument;
  existingCount: number;
}): Promise<{ queued: boolean; version: NutritionVersion }> {
  const base = `/api/clients/${encodeURIComponent(params.clientId)}/nutrition-plans`;
  const isUpdate = Boolean(params.versionId && params.planId);
  const resolvedPlanId =
    params.planId ?? params.provisionalPlanId ?? crypto.randomUUID();
  const resolvedVersionId =
    params.versionId ?? params.provisionalVersionId ?? crypto.randomUUID();
  const endpoint = isUpdate
    ? `${base}/${encodeURIComponent(resolvedPlanId)}/versions/${encodeURIComponent(resolvedVersionId)}`
    : params.planId
      ? `${base}/${encodeURIComponent(resolvedPlanId)}/versions`
      : base;
  const method: 'POST' | 'PATCH' = isUpdate ? 'PATCH' : 'POST';
  const body = isUpdate
    ? { ...params.document, revision: params.revision ?? 1 }
    : params.planId
      ? { ...params.document, versionId: resolvedVersionId }
      : {
          ...params.document,
          id: resolvedPlanId,
          versionId: resolvedVersionId,
        };

  const outcome = await nutritionWrite({
    kind: 'nutrition.save',
    method,
    endpoint,
    body,
    label: `Guardar plan alimenticio: ${params.document.name}`,
    clientId: params.clientId,
    clientName: params.clientName,
    entityKey: resolvedPlanId,
    readEndpoint: base,
  });

  if (outcome.queued) {
    return {
      queued: true,
      version: {
        ...params.document,
        id: resolvedVersionId,
        planId: resolvedPlanId,
        clientId: params.clientId,
        number: params.existingCount + 1,
        revision: isUpdate ? (params.revision ?? 1) + 1 : 1,
        published: false,
        createdAt: new Date().toISOString(),
      },
    };
  }
  if (!isNutritionVersion(outcome.result)) {
    throw new Error(
      'La respuesta del servidor no coincide con el plan nutricional.'
    );
  }
  return { queued: false, version: outcome.result };
}

export async function activateNutritionVersionOffline(params: {
  clientId: string;
  clientName: string;
  planId: string;
  versionId: string;
  expectedActiveRevision: number;
  planName: string;
}): Promise<{
  queued: boolean;
  result?: { version: NutritionVersion; activeRevision: number };
}> {
  const base = `/api/clients/${encodeURIComponent(params.clientId)}/nutrition-plans`;
  const endpoint = `${base}/${encodeURIComponent(params.planId)}/versions/${encodeURIComponent(params.versionId)}/activate`;
  const outcome = await nutritionWrite({
    kind: 'nutrition.activate',
    method: 'POST',
    endpoint,
    body: { expectedActiveRevision: params.expectedActiveRevision },
    label: `Activar plan alimenticio: ${params.planName}`,
    clientId: params.clientId,
    clientName: params.clientName,
    entityKey: params.planId,
    readEndpoint: base,
  });
  return {
    queued: outcome.queued,
    result: outcome.result as
      { version: NutritionVersion; activeRevision: number } | undefined,
  };
}

export async function createNutritionDraft(
  clientId: string,
  planId: string | undefined,
  document: NutritionDocument
): Promise<NutritionVersion> {
  const base = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans`;
  const endpoint = planId
    ? `${base}/${encodeURIComponent(planId)}/versions`
    : base;
  const saved = await sessionMutation<unknown>(endpoint, document, 'POST');
  if (!isNutritionVersion(saved)) {
    throw new Error(
      'La respuesta del servidor no coincide con el plan nutricional.'
    );
  }
  return saved;
}

export async function updateNutritionDraft(
  clientId: string,
  planId: string,
  versionId: string,
  revision: number,
  document: NutritionDocument
): Promise<NutritionVersion> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}`;
  const saved = await sessionMutation<unknown>(
    endpoint,
    { ...document, revision },
    'PATCH'
  );
  if (!isNutritionVersion(saved)) {
    throw new Error(
      'La respuesta del servidor no coincide con el plan nutricional.'
    );
  }
  return saved;
}

export async function activateNutritionVersion(
  clientId: string,
  planId: string,
  versionId: string,
  expectedActiveRevision: number
): Promise<{ version: NutritionVersion; activeRevision: number }> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/activate`;
  return sessionMutation<{ version: NutritionVersion; activeRevision: number }>(
    endpoint,
    { expectedActiveRevision },
    'POST'
  );
}

export function emptyItem(kind: NutritionItemKind = 'food'): NutritionItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: kind === 'recipe' ? 1 : 0,
    unit: kind === 'recipe' ? 'porción' : 'g',
    instructions: null,
    kind,
    recipeIngredients: null,
    foodGroup: null,
    substitutes: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
}

export function emptyMeal(
  name = 'Comida 1',
  category: NutritionMealCategory | null = null,
  scheduleTime: string | null = null
): NutritionMeal {
  return {
    id: crypto.randomUUID(),
    name,
    instructions: null,
    scheduleTime,
    category,
    targetCalories: null,
    targetProteinG: null,
    targetCarbsG: null,
    targetFatG: null,
    items: [],
  };
}

export function emptyNutritionDocument(): NutritionDocument {
  return {
    name: 'Plan alimenticio inicial',
    caloriesTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    generalInstructions: null,
    fiberTargetG: null,
    hydrationTargetMl: null,
    restDayTargets: null,
    periWorkout: null,
    suggestionMeta: null,
    meals: [
      emptyMeal('Desayuno', 'breakfast', '08:00'),
      emptyMeal('Comida', 'lunch', '14:00'),
      emptyMeal('Cena', 'dinner', '20:30'),
    ],
  };
}

export function cloneNutritionDocument(
  source: NutritionDocument
): NutritionDocument {
  return {
    name: source.name,
    caloriesTarget: source.caloriesTarget,
    proteinTargetG: source.proteinTargetG,
    carbsTargetG: source.carbsTargetG,
    fatTargetG: source.fatTargetG,
    generalInstructions: source.generalInstructions ?? null,
    fiberTargetG: source.fiberTargetG ?? null,
    hydrationTargetMl: source.hydrationTargetMl ?? null,
    restDayTargets: source.restDayTargets ? { ...source.restDayTargets } : null,
    periWorkout: source.periWorkout ? { ...source.periWorkout } : null,
    suggestionMeta: source.suggestionMeta ? { ...source.suggestionMeta } : null,
    meals: source.meals.map((meal) => ({
      id: crypto.randomUUID(),
      name: meal.name,
      instructions: meal.instructions ?? null,
      scheduleTime: meal.scheduleTime ?? null,
      category: meal.category ?? null,
      targetCalories: meal.targetCalories ?? null,
      targetProteinG: meal.targetProteinG ?? null,
      targetCarbsG: meal.targetCarbsG ?? null,
      targetFatG: meal.targetFatG ?? null,
      items: meal.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        instructions: item.instructions ?? null,
        kind: item.kind ?? 'food',
        recipeIngredients: item.recipeIngredients
          ? item.recipeIngredients.map((ing) => ({ ...ing }))
          : null,
        foodGroup: item.foodGroup ?? null,
        substitutes: item.substitutes ?? null,
        calories: item.calories ?? null,
        proteinG: item.proteinG ?? null,
        carbsG: item.carbsG ?? null,
        fatG: item.fatG ?? null,
      })),
    })),
  };
}
