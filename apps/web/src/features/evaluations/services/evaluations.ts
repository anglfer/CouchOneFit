import { invalidateEvolutionReads } from './evolution';
import { ApiError } from '../../../services/api';
import type { AssessmentInput } from '../types/assessment';
import { sessionMutation } from '../../auth/services/session';
import {
  submitWrite,
  type WriteOutcome,
} from '../../../services/offline/writes';
import {
  isEvaluation,
  type Evaluation,
  type EvaluationMeasurements,
} from '../types/evaluation';

export async function createEvaluation(
  clientId: string,
  clientName: string,
  measurements: EvaluationMeasurements | AssessmentInput,
  operationId?: string
): Promise<WriteOutcome<Evaluation>> {
  const endpoint = `/api/clients/${encodeURIComponent(clientId)}/evaluations`;
  const outcome = await submitWrite(
    {
      kind: 'evaluation.create',
      method: 'POST',
      endpoint,
      body: { ...measurements },
      label: `Registrar evaluación de ${clientName}`,
      clientId,
      clientName,
    },
    (headers) =>
      sessionMutation<{ evaluation: unknown }>(
        endpoint,
        measurements,
        'POST',
        headers
      ),
    { id: operationId, timeoutMs: 20_000 }
  );
  if (outcome.status === 'done') {
    if (!outcome.result || !isEvaluation(outcome.result.evaluation, clientId))
      throw new ApiError(
        502,
        'EVALUATION_RESPONSE_UNCERTAIN',
        'No pudimos interpretar la confirmación. Reintenta con la misma operación para comprobar el resultado.'
      );
    invalidateEvolutionReads();
    return { status: 'done', result: outcome.result.evaluation };
  }
  return outcome;
}
