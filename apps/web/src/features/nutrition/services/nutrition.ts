import { sessionMutation, sessionRequest } from '../../auth/services/session';
import type {
  NutritionDocument,
  NutritionItem,
  NutritionMeal,
  NutritionVersion,
  NutritionVersionsResponse,
} from '../types/nutrition';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isNullableNumber = (v: unknown) => v === null || typeof v === 'number';
const isNullableString = (v: unknown) => v === null || typeof v === 'string';

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
    Array.isArray(v.meals) &&
    v.meals.every(
      (m) =>
        isRecord(m) &&
        typeof m.id === 'string' &&
        typeof m.name === 'string' &&
        isNullableString(m.instructions) &&
        Array.isArray(m.items) &&
        m.items.every(
          (i) =>
            isRecord(i) &&
            typeof i.id === 'string' &&
            typeof i.name === 'string' &&
            typeof i.quantity === 'number' &&
            typeof i.unit === 'string' &&
            isNullableString(i.instructions),
        ),
    )
  );
}

export async function readNutritionVersions(clientId: string): Promise<NutritionVersionsResponse> {
  const value = await sessionRequest<unknown>(
    `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans`,
  );
  if (
    !isRecord(value) ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isNutritionVersion) ||
    (value.activeVersionId !== null && typeof value.activeVersionId !== 'string') ||
    typeof value.activeRevision !== 'number' ||
    typeof value.canWrite !== 'boolean'
  ) {
    throw new Error('No pudimos interpretar los planes alimenticios.');
  }
  return value as unknown as NutritionVersionsResponse;
}

export async function createNutritionDraft(
  clientId: string,
  planId: string | undefined,
  document: NutritionDocument,
): Promise<NutritionVersion> {
  const base = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans`;
  const endpoint = planId ? `${base}/${encodeURIComponent(planId)}/versions` : base;
  const saved = await sessionMutation<unknown>(endpoint, document, 'POST');
  if (!isNutritionVersion(saved)) {
    throw new Error('La respuesta del servidor no coincide con el plan nutricional.');
  }
  return saved;
}

export async function updateNutritionDraft(
  clientId: string,
  planId: string,
  versionId: string,
  revision: number,
  document: NutritionDocument,
): Promise<NutritionVersion> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}`;
  const saved = await sessionMutation<unknown>(endpoint, { ...document, revision }, 'PATCH');
  if (!isNutritionVersion(saved)) {
    throw new Error('La respuesta del servidor no coincide con el plan nutricional.');
  }
  return saved;
}

export async function activateNutritionVersion(
  clientId: string,
  planId: string,
  versionId: string,
  expectedActiveRevision: number,
): Promise<{ version: NutritionVersion; activeRevision: number }> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/activate`;
  return sessionMutation<{ version: NutritionVersion; activeRevision: number }>(
    endpoint,
    { expectedActiveRevision },
    'POST',
  );
}

export function emptyItem(): NutritionItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 100,
    unit: 'g',
    instructions: null,
  };
}

export function emptyMeal(name = 'Comida 1'): NutritionMeal {
  return {
    id: crypto.randomUUID(),
    name,
    instructions: null,
    items: [emptyItem()],
  };
}

export function emptyNutritionDocument(): NutritionDocument {
  return {
    name: 'Plan alimenticio inicial',
    caloriesTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    meals: [emptyMeal('Desayuno'), emptyMeal('Comida'), emptyMeal('Cena')],
  };
}

export function cloneNutritionDocument(source: NutritionDocument): NutritionDocument {
  return {
    name: source.name,
    caloriesTarget: source.caloriesTarget,
    proteinTargetG: source.proteinTargetG,
    carbsTargetG: source.carbsTargetG,
    fatTargetG: source.fatTargetG,
    meals: source.meals.map((meal) => ({
      id: crypto.randomUUID(),
      name: meal.name,
      instructions: meal.instructions,
      items: meal.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        instructions: item.instructions,
      })),
    })),
  };
}