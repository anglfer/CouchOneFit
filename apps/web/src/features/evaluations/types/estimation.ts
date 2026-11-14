/** Pending TECHNICAL reference; no scientifically approved protocol/version. */
export const pendingEstimationReference = {
  methodId: 'jackson-pollock-3-siri',
  protocolId: 'jp3-sites-pending',
  protocolVersion: 'technical-reference-v1',
} as const;
export const pendingEstimationVersion = 'composition-estimation-v1';

export interface PendingEstimation {
  status: 'unavailable';
  result: null;
  formulaVersion: null;
  domainPolicyVersion: null;
  reasons: [{ code: 'scientific_verification_pending'; fields: [] }];
}

/** Validates this release's closed unavailable-only snapshot, not candidates. */
export function isPendingEstimation(
  value: unknown,
  snapshot: Record<string, unknown>
): value is PendingEstimation {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  if (!object(value) || !object(value.inputs) || !object(value.protocol))
    return false;
  const expectedFields = [
    'schemaVersion',
    'methodId',
    'variant',
    'formulaVersion',
    'domainPolicyVersion',
    'protocol',
    'provenance',
    'inputs',
    'status',
    'result',
    'reasons',
  ];
  if (
    Object.keys(value).length !== expectedFields.length ||
    Object.keys(value).some((k) => !expectedFields.includes(k))
  )
    return false;
  if (
    snapshot.ageYears !== null &&
    (typeof snapshot.ageYears !== 'number' ||
      !Number.isSafeInteger(snapshot.ageYears) ||
      snapshot.ageYears < 0)
  )
    return false;
  if (snapshot.provenance !== 'manual_measurements') return false;
  const variant =
    snapshot.equation === 'not_applicable' ? null : snapshot.equation;
  if (variant !== null && variant !== 'male' && variant !== 'female')
    return false;
  const equal = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b))
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((v, i) => equal(v, b[i]))
      );
    if (!object(a) || !object(b)) return a === b;
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
    );
  };
  if (!object(snapshot.measurements)) return false;
  const fields = [
    'pectoralSkinfoldMm',
    'abdominalSkinfoldMm',
    'tricepsSkinfoldMm',
    'bicepsSkinfoldMm',
    'subscapularSkinfoldMm',
    'suprailiacSkinfoldMm',
    'thighSkinfoldMm',
  ];
  const measurements = snapshot.measurements;
  const skinfolds =
    variant === null
      ? {}
      : Object.fromEntries(
          fields
            .filter((k) => measurements[k] !== undefined)
            .map((k) => [k, measurements[k]])
        );
  return (
    snapshot.method === 'pliegues' &&
    snapshot.calculationStatus === 'pending_verification' &&
    snapshot.protocol === 'jp3-sites-pending@technical-reference-v1' &&
    object(snapshot.results) &&
    Object.keys(snapshot.results).length === 0 &&
    value.schemaVersion === 1 &&
    value.methodId === pendingEstimationReference.methodId &&
    value.variant === variant &&
    value.formulaVersion === null &&
    value.domainPolicyVersion === null &&
    equal(value.protocol, {
      id: pendingEstimationReference.protocolId,
      version: pendingEstimationReference.protocolVersion,
    }) &&
    value.provenance === 'server_estimation' &&
    value.status === 'unavailable' &&
    value.result === null &&
    equal(value.inputs, {
      effectiveDate: snapshot.effectiveDate,
      ageYears: snapshot.ageYears,
      unit: 'mm',
      skinfolds,
    }) &&
    Array.isArray(value.reasons) &&
    value.reasons.length === 1 &&
    object(value.reasons[0]) &&
    equal(value.reasons[0], {
      code: 'scientific_verification_pending',
      fields: [],
    })
  );
}

export const candidateEstimationVersion = 'composition-candidate-v1';
export const candidateProtocolVersion = 'technical-candidate-v1' as const;
export const candidateProtocols = {
  male: 'jp3-male-candidate',
  female: 'jp3-female-candidate',
} as const;
export interface CandidateEstimation {
  status: 'candidate_only' | 'unavailable';
  result: {
    sumSkinfoldMm: number;
    bodyDensityGPerMl: number;
    estimatedBodyFatPercentage: number;
  } | null;
  variant: 'male' | 'female' | null;
  technicalFormulaVersion: 'jp3-siri-arithmetic-candidate-v1';
  technicalDomainVersion: 'jp3-reference-ranges-candidate-v1';
  blockers: string[];
  reasons: { code: string; fields: string[] }[];
}

export function isCandidateEstimation(
  value: unknown,
  snapshot: Record<string, unknown>
): value is CandidateEstimation {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const equal = (a: unknown, b: unknown): boolean => {
    if (Array.isArray(a) || Array.isArray(b))
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((v, i) => equal(v, b[i]))
      );
    if (!object(a) || !object(b)) return a === b;
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
    );
  };
  if (
    !object(value) ||
    !object(value.inputs) ||
    !object(snapshot.measurements) ||
    !object(snapshot.results)
  )
    return false;
  const variant =
    snapshot.equation === 'not_applicable' ? null : snapshot.equation;
  if (variant !== null && variant !== 'male' && variant !== 'female')
    return false;
  const age = snapshot.ageYears;
  if (
    age !== null &&
    (typeof age !== 'number' || !Number.isSafeInteger(age) || age < 0)
  )
    return false;
  if (
    snapshot.method !== 'pliegues' ||
    snapshot.calculationStatus !== 'pending_verification' ||
    snapshot.provenance !== 'manual_measurements' ||
    Object.keys(snapshot.results).length !== 0
  )
    return false;
  const protocolId =
    typeof snapshot.protocol === 'string'
      ? snapshot.protocol.split('@')[0]
      : '';
  if (
    !Object.values(candidateProtocols).some((id) => id === protocolId) ||
    snapshot.protocol !== protocolId + '@' + candidateProtocolVersion ||
    (variant !== null && candidateProtocols[variant] !== protocolId)
  )
    return false;
  const blockers = [
    'scientific_verification_pending',
    'domain_approval_pending',
    'protocol_approval_pending',
    'independent_reference_cases_pending',
  ];
  if (variant === 'female') {
    blockers.push('female_equation_original_pending');
    if (typeof age === 'number' && age > 40)
      blockers.push('female_over_40_caution_pending');
  }
  const base = {
    schemaVersion: 1,
    methodId: 'jackson-pollock-3-siri',
    variant,
    protocol: { id: protocolId, version: candidateProtocolVersion },
    formulaVersion: null,
    domainPolicyVersion: null,
    technicalFormulaVersion: 'jp3-siri-arithmetic-candidate-v1',
    technicalDomainVersion: 'jp3-reference-ranges-candidate-v1',
    scientificStatus: 'not_validated',
    activationAllowed: false,
    provenance: 'server_estimation',
    blockers,
  };
  const other = Object.fromEntries(
    Object.entries(value).filter(
      ([k]) => !['status', 'inputs', 'result', 'reasons'].includes(k)
    )
  );
  if (!equal(other, base)) return false;
  const fields = [
    'pectoralSkinfoldMm',
    'abdominalSkinfoldMm',
    'tricepsSkinfoldMm',
    'bicepsSkinfoldMm',
    'subscapularSkinfoldMm',
    'suprailiacSkinfoldMm',
    'thighSkinfoldMm',
  ];
  const sites =
    variant === 'male'
      ? ['pectoralSkinfoldMm', 'abdominalSkinfoldMm', 'thighSkinfoldMm']
      : ['tricepsSkinfoldMm', 'suprailiacSkinfoldMm', 'thighSkinfoldMm'];
  const captured = snapshot.measurements;
  const all =
    variant === null
      ? {}
      : Object.fromEntries(
          fields
            .filter((k) => captured[k] !== undefined)
            .map((k) => [k, captured[k]])
        );
  const selected = Object.fromEntries(
    sites.filter((k) => captured[k] !== undefined).map((k) => [k, captured[k]])
  );
  const inputs = (skinfolds: unknown) => ({
    effectiveDate: snapshot.effectiveDate,
    ageYears: age,
    unit: 'mm',
    skinfolds,
  });
  if (value.status === 'unavailable') {
    const codes = [
      'candidate_execution_disabled',
      'invalid_input',
      'equation_not_selected',
      'invalid_effective_date',
      'invalid_birth_date',
      'age_unavailable',
      'outside_reference_age_range',
      'invalid_measurements',
      'missing_measurements',
      'non_finite_calculation',
      'invalid_density',
      'invalid_estimated_percentage',
    ];
    return (
      value.result === null &&
      (equal(value.inputs, inputs(all)) ||
        equal(value.inputs, inputs(selected))) &&
      Array.isArray(value.reasons) &&
      value.reasons.length === 1 &&
      object(value.reasons[0]) &&
      Object.keys(value.reasons[0]).length === 2 &&
      codes.includes(String(value.reasons[0].code)) &&
      Array.isArray(value.reasons[0].fields) &&
      value.reasons[0].fields.every((f) => typeof f === 'string')
    );
  }
  if (
    value.status !== 'candidate_only' ||
    variant === null ||
    typeof age !== 'number' ||
    age < 18 ||
    age > (variant === 'male' ? 61 : 55) ||
    Object.keys(selected).length !== 3 ||
    !equal(value.inputs, inputs(selected)) ||
    !equal(value.reasons, [])
  )
    return false;
  const r = value.result;
  return (
    object(r) &&
    Object.keys(r).length === 3 &&
    ['sumSkinfoldMm', 'bodyDensityGPerMl', 'estimatedBodyFatPercentage'].every(
      (k) => typeof r[k] === 'number' && Number.isFinite(r[k]) && r[k] > 0
    ) &&
    Number(r.estimatedBodyFatPercentage) < 100
  );
}
