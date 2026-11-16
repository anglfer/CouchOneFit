import {
  ESTIMATION_METHOD_ID,
  ESTIMATION_SKINFOLD_FIELDS,
  type EstimationInputs,
  type EstimationResult,
  type EstimationSkinfoldField,
  type EstimationVariant,
} from '../types/estimation.js';

/**
 * Candidate arithmetic ONLY. Sources/localizers and unapproved reference cases:
 * docs/epicas/ep-04-antropometria/hu-023/{README,casos-patron-candidatos}.md.
 * Male: Jackson/Pollock 1978, table 4 equation 5 (transcription checked).
 * Female: plan DEC-007 archived transcription (original still NOT checked).
 * Siri: 1961 p. 230 equation 10. Never silently substitute its discrepant example.
 * No clinical approval registry. Only the gated local adapter may invoke this engine.
 */
export interface CandidateEstimationInput {
  readonly variant: EstimationVariant | null;
  readonly birthDate: string | null;
  readonly effectiveDate: string;
  readonly unit: 'mm';
  readonly skinfolds: Readonly<
    Partial<Record<EstimationSkinfoldField, number | null>>
  >;
}

export type CandidateBlocker =
  | 'scientific_verification_pending'
  | 'domain_approval_pending'
  | 'protocol_approval_pending'
  | 'independent_reference_cases_pending'
  | 'female_equation_original_pending'
  | 'female_over_40_caution_pending';

export type CandidateFailureCode =
  | 'invalid_input'
  | 'equation_not_selected'
  | 'invalid_effective_date'
  | 'invalid_birth_date'
  | 'age_unavailable'
  | 'outside_reference_age_range'
  | 'invalid_measurements'
  | 'missing_measurements'
  | 'non_finite_calculation'
  | 'invalid_density'
  | 'invalid_estimated_percentage';

interface CandidateMetadata {
  readonly methodId: typeof ESTIMATION_METHOD_ID;
  readonly activationAllowed: false;
  readonly formulaVersion: null;
  readonly domainPolicyVersion: null;
  readonly protocolVersion: null;
  readonly blockers: readonly CandidateBlocker[];
}

export type CandidateEstimationOutcome = CandidateMetadata &
  (
    | {
        readonly status: 'candidate_only';
        readonly variant: EstimationVariant;
        readonly inputs: EstimationInputs & { readonly ageYears: number };
        readonly equationEvidence:
          'male_transcription_checked' | 'female_transcription_provisional';
        readonly candidateResult: EstimationResult;
        readonly reason: null;
      }
    | {
        readonly status: 'unavailable';
        readonly candidateResult: null;
        readonly reason: {
          readonly code: CandidateFailureCode;
          readonly fields: readonly string[];
        };
      }
  );

export type CandidateSiriOutcome = CandidateMetadata &
  (
    | {
        readonly status: 'candidate_only';
        readonly candidatePercentage: number;
        readonly reason: null;
      }
    | {
        readonly status: 'unavailable';
        readonly candidatePercentage: null;
        readonly reason: {
          readonly code:
            | 'non_finite_calculation'
            | 'invalid_density'
            | 'invalid_estimated_percentage';
        };
      }
  );

function metadata(
  variant: EstimationVariant | null = null,
  ageYears: number | null = null
): CandidateMetadata {
  const blockers: CandidateBlocker[] = [
    'scientific_verification_pending',
    'domain_approval_pending',
    'protocol_approval_pending',
    'independent_reference_cases_pending',
  ];
  if (variant === 'female') {
    blockers.push('female_equation_original_pending');
    if (ageYears !== null && ageYears > 40)
      blockers.push('female_over_40_caution_pending');
  }
  return {
    methodId: ESTIMATION_METHOD_ID,
    activationAllowed: false,
    formulaVersion: null,
    domainPolicyVersion: null,
    protocolVersion: null,
    blockers,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function calendarDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** Isolated Siri conversion for candidate/guard tests, never an approved result. */
export function candidateSiriPercentage(
  density: unknown
): CandidateSiriOutcome {
  const base = metadata();
  const failure = (
    code:
      | 'non_finite_calculation'
      | 'invalid_density'
      | 'invalid_estimated_percentage'
  ): CandidateSiriOutcome => ({
    ...base,
    status: 'unavailable',
    candidatePercentage: null,
    reason: { code },
  });
  if (typeof density !== 'number' || !Number.isFinite(density))
    return failure('non_finite_calculation');
  if (density <= 0) return failure('invalid_density');
  const percentage = 495 / density - 450;
  if (!Number.isFinite(percentage)) return failure('non_finite_calculation');
  if (percentage <= 0 || percentage >= 100)
    return failure('invalid_estimated_percentage');
  return {
    ...base,
    status: 'candidate_only',
    candidatePercentage: percentage,
    reason: null,
  };
}

/**
 * No current age/clock, approved-domain claim or caller-controlled approval flag.
 * The age intervals below ONLY confine arithmetic to documented reference ranges;
 * every numerical outcome remains blocked, including female subjects over 40.
 */
export function calculateCandidateBodyFat(
  input: unknown
): CandidateEstimationOutcome {
  let variant: EstimationVariant | null = null;
  let ageYears: number | null = null;
  const fail = (
    code: CandidateFailureCode,
    fields: readonly string[] = []
  ): CandidateEstimationOutcome => ({
    ...metadata(variant, ageYears),
    status: 'unavailable',
    candidateResult: null,
    reason: { code, fields: [...fields] },
  });
  if (!record(input)) return fail('invalid_input');
  if (
    Object.keys(input).some(
      (key) =>
        ![
          'variant',
          'birthDate',
          'effectiveDate',
          'unit',
          'skinfolds',
        ].includes(key)
    )
  )
    return fail('invalid_input');
  if (input.variant === null || input.variant === undefined)
    return fail('equation_not_selected', ['variant']);
  if (input.variant !== 'male' && input.variant !== 'female')
    return fail('invalid_input', ['variant']);
  variant = input.variant;
  if (!calendarDate(input.effectiveDate))
    return fail('invalid_effective_date', ['effectiveDate']);
  if (input.birthDate === null || input.birthDate === undefined)
    return fail('age_unavailable', ['birthDate']);
  if (!calendarDate(input.birthDate) || input.birthDate > input.effectiveDate)
    return fail('invalid_birth_date', ['birthDate']);
  // Completed years at the explicit effective date, never at server "today".
  ageYears =
    Number(input.effectiveDate.slice(0, 4)) -
    Number(input.birthDate.slice(0, 4));
  if (input.effectiveDate.slice(5) < input.birthDate.slice(5)) ageYears -= 1;
  if (ageYears < 18 || ageYears > (variant === 'male' ? 61 : 55))
    return fail('outside_reference_age_range', ['birthDate', 'effectiveDate']);
  if (input.unit !== 'mm' || !record(input.skinfolds))
    return fail('invalid_measurements', ['unit', 'skinfolds']);
  const measurements = input.skinfolds;
  for (const [field, value] of Object.entries(measurements)) {
    if (!(ESTIMATION_SKINFOLD_FIELDS as readonly string[]).includes(field))
      return fail('invalid_measurements', [`skinfolds.${field}`]);
    // Missing/null remain absent; never become 0 or a default site value.
    if (value === null || value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 1 ||
      value > 80 ||
      !Number.isInteger(value * 10)
    )
      return fail('invalid_measurements', [`skinfolds.${field}`]);
  }
  const sites: readonly EstimationSkinfoldField[] =
    variant === 'male'
      ? ['pectoralSkinfoldMm', 'abdominalSkinfoldMm', 'thighSkinfoldMm']
      : ['tricepsSkinfoldMm', 'suprailiacSkinfoldMm', 'thighSkinfoldMm'];
  const missing = sites.filter((site) => measurements[site] == null);
  if (missing.length)
    return fail(
      'missing_measurements',
      missing.map((site) => `skinfolds.${site}`)
    );
  const skinfolds: Partial<Record<EstimationSkinfoldField, number>> = {};
  for (const site of sites) skinfolds[site] = measurements[site] as number;
  const sumSkinfoldMm = sites.reduce((sum, site) => sum + skinfolds[site]!, 0);
  const bodyDensityGPerMl =
    variant === 'male'
      ? 1.10938 -
        0.0008267 * sumSkinfoldMm +
        0.0000016 * sumSkinfoldMm ** 2 -
        0.0002574 * ageYears
      : 1.0994921 -
        0.0009929 * sumSkinfoldMm +
        0.0000023 * sumSkinfoldMm ** 2 -
        0.0001392 * ageYears;
  if (!Number.isFinite(sumSkinfoldMm) || !Number.isFinite(bodyDensityGPerMl))
    return fail('non_finite_calculation');
  const siri = candidateSiriPercentage(bodyDensityGPerMl);
  if (siri.status === 'unavailable') return fail(siri.reason.code);
  return {
    ...metadata(variant, ageYears),
    status: 'candidate_only',
    variant,
    equationEvidence:
      variant === 'male'
        ? 'male_transcription_checked'
        : 'female_transcription_provisional',
    inputs: {
      effectiveDate: input.effectiveDate,
      ageYears,
      unit: 'mm',
      skinfolds,
    },
    candidateResult: {
      sumSkinfoldMm,
      bodyDensityGPerMl,
      estimatedBodyFatPercentage: siri.candidatePercentage,
    },
    reason: null,
  };
}
