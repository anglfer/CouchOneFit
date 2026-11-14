import type { AssessmentInput } from './assessment.js';
import {
  ESTIMATION_METHOD_ID,
  ESTIMATION_SKINFOLD_FIELDS,
  PENDING_ESTIMATION_REFERENCE,
  type UnavailableBodyFatEstimation,
} from '../types/estimation.js';

/** Builds pending metadata only. Does not import or execute candidate arithmetic. */
export function pendingEstimation(
  input: AssessmentInput,
  effectiveDate: string,
  ageYears: number | null
): UnavailableBodyFatEstimation {
  const variant = input.equation === 'not_applicable' ? null : input.equation;
  return {
    schemaVersion: 1,
    methodId: ESTIMATION_METHOD_ID,
    variant,
    formulaVersion: null,
    domainPolicyVersion: null,
    protocol: { ...PENDING_ESTIMATION_REFERENCE },
    provenance: 'server_estimation',
    inputs: {
      effectiveDate,
      ageYears,
      unit: 'mm',
      // Pending reference does not select or certify three anatomical sites.
      skinfolds:
        variant === null
          ? {}
          : Object.fromEntries(
              ESTIMATION_SKINFOLD_FIELDS.filter(
                (key) => input.measurements[key] !== undefined
              ).map((key) => [key, input.measurements[key]])
            ),
    },
    status: 'unavailable',
    result: null,
    reasons: [{ code: 'scientific_verification_pending', fields: [] }],
  };
}
