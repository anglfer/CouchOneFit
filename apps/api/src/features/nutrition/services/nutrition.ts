import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import * as nutritionRepository from '../repositories/nutrition.js';
import { generateNutritionSuggestion } from '../domain/suggestion-engine.js';
import {
  nutritionDocument,
  uuid,
  number,
  validateActivation,
  validateSuggestionInput,
} from '../validators/nutrition.js';
import type { NutritionVersion, NutritionVersionsResponse } from '../types/nutrition.js';

function localDateInZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export async function getVersions(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
): Promise<NutritionVersionsResponse> {
  const targetId = uuid(clientId);
  return nutritionRepository.read(pool, identity, async (c) => {
    const s = await nutritionRepository.scope(c, identity, targetId);
    const [list, currentActive] = await Promise.all([
      nutritionRepository.versions(c, identity, targetId),
      nutritionRepository.active(c, targetId),
    ]);
    return {
      versions: list,
      activeVersionId: currentActive.versionId,
      activeRevision: currentActive.revision,
      canWrite: s.canWrite,
    };
  });
}

export async function getActivePlanSummary(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
): Promise<{ plan: NutritionVersion | null; activeRevision: number }> {
  const targetId = uuid(clientId);
  return nutritionRepository.read(pool, identity, async (c) => {
    await nutritionRepository.scope(c, identity, targetId, false);
    return nutritionRepository.activeProfessionalPlan(c, identity, targetId);
  });
}

export async function generateSuggestion(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  body: unknown,
  now: Date,
) {
  const targetId = uuid(clientId);
  const input = validateSuggestionInput(body);
  return nutritionRepository.read(pool, identity, async (c) => {
    await nutritionRepository.scope(c, identity, targetId, true);
    await nutritionRepository.requireEvaluation(c, targetId);
    return {
      suggestion: generateNutritionSuggestion(input, now),
    };
  });
}

export async function saveDraft(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  planId: string | undefined,
  body: unknown,
): Promise<NutritionVersion> {
  const targetId = uuid(clientId);
  const targetPlanId = planId ? uuid(planId) : undefined;
  const document = nutritionDocument(body);
  return nutritionRepository.read(pool, identity, async (c) => {
    await nutritionRepository.scope(c, identity, targetId, true);
    await nutritionRepository.requireEvaluation(c, targetId);
    let resolvedPlanId: string;
    if (targetPlanId) {
      await nutritionRepository.ownedPlan(c, identity, targetPlanId, targetId);
      resolvedPlanId = targetPlanId;
    } else {
      resolvedPlanId = await nutritionRepository.getOrCreatePlanId(c, identity, targetId);
    }
    return nutritionRepository.storeVersion(c, resolvedPlanId, randomUUID(), document);
  });
}

export async function updateDraft(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  planId: string,
  versionId: string,
  body: unknown,
): Promise<NutritionVersion> {
  const targetId = uuid(clientId);
  const targetPlanId = uuid(planId);
  const targetVersionId = uuid(versionId);
  const rawRevision =
    body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).revision : undefined;
  const currentRevision = number(rawRevision, 1, 1000000);
  const document = nutritionDocument(body);

  return nutritionRepository.read(pool, identity, async (c) => {
    await nutritionRepository.scope(c, identity, targetId, true);
    await nutritionRepository.requireEvaluation(c, targetId);
    await nutritionRepository.ownedPlan(c, identity, targetPlanId, targetId);
    const v = await nutritionRepository.version(c, targetVersionId);
    if (v.planId !== targetPlanId) throw nutritionRepository.missing();
    if (v.published) throw nutritionRepository.conflict('No se puede editar una versión ya publicada.');
    return nutritionRepository.storeVersion(c, targetPlanId, targetVersionId, document, currentRevision);
  });
}

export async function activateVersion(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  planId: string,
  versionId: string,
  body: unknown,
  now: Date,
) {
  const targetId = uuid(clientId);
  const targetPlanId = uuid(planId);
  const targetVersionId = uuid(versionId);
  const { expectedActiveRevision } = validateActivation(body);

  return nutritionRepository.read(pool, identity, async (c) => {
    const s = await nutritionRepository.scope(c, identity, targetId, true);
    await nutritionRepository.ownedPlan(c, identity, targetPlanId, targetId);
    const v = await nutritionRepository.version(c, targetVersionId);
    if (v.planId !== targetPlanId) throw nutritionRepository.missing();
    const localDate = localDateInZone(now, s.timeZone);
    return nutritionRepository.activate(
      c,
      identity,
      targetId,
      v,
      expectedActiveRevision,
      now,
      localDate,
      s.timeZone,
    );
  });
}

export async function getActivePlanForClient(pool: Pool, identity: SessionIdentity) {
  return nutritionRepository.read(pool, identity, async (c) => {
    const s = await nutritionRepository.scope(c, identity, null, false);
    const plan = await nutritionRepository.activeClientPlan(c, s.clientId);
    return { plan };
  });
}
