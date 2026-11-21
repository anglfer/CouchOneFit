/** Scientific approval remains pending; runtime distinguishes pending and gated local candidates. */
export const ESTIMATION_METHOD_ID = 'jackson-pollock-3-siri' as const;

/** Technical pending reference ONLY; never an approved measurement protocol. */
export const PENDING_ESTIMATION_REFERENCE = Object.freeze({
  id: 'jp3-sites-pending',
  version: 'technical-reference-v1',
});
export const PENDING_ESTIMATION_SNAPSHOT_VERSION =
  'composition-estimation-v1' as const;

/** Response version for skinfold assessments derived with official JP3 + Siri. */
export const SKINFOLD_RESULT_VERSION = 'composition-skinfold-v1' as const;
export const SKINFOLD_FORMULA_VERSION = 'jp3-siri-v1' as const;
export const SKINFOLD_DOMAIN_VERSION = 'jp3-reference-ranges-v1' as const;

/** Technical candidates authorized for local testing; no scientific approval. */
export const CANDIDATE_ESTIMATION_VERSION = 'composition-candidate-v1' as const;
export const CANDIDATE_PROTOCOL_VERSION = 'technical-candidate-v1' as const;
export const CANDIDATE_FORMULA_VERSION =
  'jp3-siri-arithmetic-candidate-v1' as const;
export const CANDIDATE_DOMAIN_VERSION =
  'jp3-reference-ranges-candidate-v1' as const;
export const CANDIDATE_PROTOCOLS = {
  male: 'jp3-male-candidate',
  female: 'jp3-female-candidate',
} as const;

export interface CandidateBodyFatEstimation {
  readonly schemaVersion: 1;
  readonly methodId: typeof ESTIMATION_METHOD_ID;
  readonly variant: EstimationVariant | null;
  readonly protocol: EstimationProtocol;
  readonly formulaVersion: null;
  readonly domainPolicyVersion: null;
  readonly technicalFormulaVersion: typeof CANDIDATE_FORMULA_VERSION;
  readonly technicalDomainVersion: typeof CANDIDATE_DOMAIN_VERSION;
  readonly scientificStatus: 'not_validated';
  readonly activationAllowed: false;
  readonly provenance: 'server_estimation';
  readonly inputs: EstimationInputs;
  readonly blockers: readonly string[];
  readonly reasons: readonly {
    readonly code: string;
    readonly fields: readonly string[];
  }[];
  readonly status: 'candidate_only' | 'unavailable';
  readonly result: EstimationResult | null;
}

export const ESTIMATION_SKINFOLD_FIELDS = [
  'pectoralSkinfoldMm',
  'abdominalSkinfoldMm',
  'tricepsSkinfoldMm',
  'bicepsSkinfoldMm',
  'subscapularSkinfoldMm',
  'suprailiacSkinfoldMm',
  'thighSkinfoldMm',
] as const;

export type EstimationSkinfoldField =
  (typeof ESTIMATION_SKINFOLD_FIELDS)[number];
export type EstimationVariant = 'male' | 'female';

export interface EstimationRequest {
  readonly methodId: typeof ESTIMATION_METHOD_ID;
  readonly protocolId: string;
  readonly protocolVersion: string;
}

/** Optional extension; previous capture payloads do not acquire an estimation request. */
export interface EstimationRequestExtension {
  readonly estimationRequest?: EstimationRequest;
}

export interface EstimationProtocol {
  readonly id: string;
  readonly version: string;
}

export interface EstimationInputs {
  readonly effectiveDate: string;
  readonly ageYears: number | null;
  readonly unit: 'mm';
  readonly skinfolds: Readonly<
    Partial<Record<EstimationSkinfoldField, number>>
  >;
}

export interface EstimationResult {
  readonly sumSkinfoldMm: number;
  readonly bodyDensityGPerMl: number;
  readonly estimatedBodyFatPercentage: number;
}

export const ESTIMATION_REASON_CODES = [
  'equation_not_selected',
  'missing_measurements',
  'age_unavailable',
  'outside_approved_domain',
  'scientific_verification_pending',
  'non_finite_calculation',
  'invalid_density',
  'invalid_estimated_percentage',
] as const;

export type EstimationReasonCode = (typeof ESTIMATION_REASON_CODES)[number];
export type EstimationField =
  | 'equation'
  | 'birthDate'
  | 'effectiveDate'
  | `measurements.${EstimationSkinfoldField}`;

export interface EstimationReason {
  readonly code: EstimationReasonCode;
  readonly fields: readonly EstimationField[];
}

interface EstimationSnapshotBase {
  readonly schemaVersion: 1;
  readonly methodId: typeof ESTIMATION_METHOD_ID;
  readonly protocol: EstimationProtocol;
  readonly provenance: 'server_estimation';
}

export interface AvailableBodyFatEstimation extends EstimationSnapshotBase {
  readonly status: 'available';
  readonly variant: EstimationVariant;
  readonly formulaVersion: string;
  readonly domainPolicyVersion: string;
  readonly inputs: EstimationInputs & { readonly ageYears: number };
  readonly result: EstimationResult;
  readonly reasons: readonly [];
}

export interface UnavailableBodyFatEstimation extends EstimationSnapshotBase {
  readonly status: 'unavailable';
  readonly variant: EstimationVariant | null;
  readonly formulaVersion: string | null;
  readonly domainPolicyVersion: string | null;
  readonly inputs: EstimationInputs;
  readonly result: null;
  readonly reasons: readonly [EstimationReason, ...EstimationReason[]];
}

export type BodyFatEstimationSnapshot =
  AvailableBodyFatEstimation | UnavailableBodyFatEstimation;

/** Old snapshots can omit this property; no existing version is redefined. */
export interface AssessmentEstimationExtension {
  readonly estimation?: BodyFatEstimationSnapshot;
}
