import type { RequestHandler } from 'express';
import { visibleCandidate } from '../domain/candidate-estimation.js';
import {
  CANDIDATE_ESTIMATION_VERSION,
  type CandidateBodyFatEstimation,
} from '../types/estimation.js';

/** Must run before idempotency so replay cannot expose a disabled candidate. */
export const candidateResponseVisibility: RequestHandler = (
  _req,
  res,
  next
) => {
  const send = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (body && typeof body === 'object' && 'evaluation' in body) {
      const evaluation = body.evaluation;
      if (
        evaluation &&
        typeof evaluation === 'object' &&
        'assessment' in evaluation
      ) {
        const assessment = evaluation.assessment;
        if (
          assessment &&
          typeof assessment === 'object' &&
          'version' in assessment &&
          assessment.version === CANDIDATE_ESTIMATION_VERSION &&
          'estimation' in assessment &&
          assessment.estimation
        ) {
          return send({
            ...body,
            evaluation: {
              ...evaluation,
              assessment: {
                ...assessment,
                estimation: visibleCandidate(
                  assessment.estimation as CandidateBodyFatEstimation
                ),
              },
            },
          });
        }
      }
    }
    return send(body);
  };
  next();
};
