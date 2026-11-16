import {
  ESTIMATION_METHOD_ID,
  ESTIMATION_REASON_CODES,
  ESTIMATION_SKINFOLD_FIELDS,
  type BodyFatEstimationSnapshot,
  type EstimationField,
  type EstimationInputs,
  type EstimationProtocol,
  type EstimationReason,
  type EstimationRequest,
  type EstimationResult,
  type EstimationVariant,
} from '../types/estimation.js';

/** Internal structural error, not a public HTTP error or a scientific verdict. */
export class EstimationContractError extends Error {
  readonly code = 'INVALID_ESTIMATION_CONTRACT';

  constructor(readonly field: string) {
    super('La estructura del contrato de estimación no es válida.');
    this.name = 'EstimationContractError';
  }
}

function fail(field: string): never {
  throw new EstimationContractError(field);
}

function object(
  value: unknown,
  field: string,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    fail(field);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) fail(`${field}.${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${field}.${key}`);
  }
  return record;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value)
    fail(field);
  return value;
}

function protocolText(value: unknown, field: string): string {
  const result = text(value, field);
  if (result.includes('@')) fail(field);
  return result;
}

function positive(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    fail(field);
  return value;
}

function protocol(value: unknown): EstimationProtocol {
  const p = object(value, 'estimation.protocol', ['id', 'version']);
  return {
    id: protocolText(p.id, 'estimation.protocol.id'),
    version: protocolText(p.version, 'estimation.protocol.version'),
  };
}

/** Shape only: unknown protocol references are NOT approved by this parser. */
export function parseEstimationRequest(value: unknown): EstimationRequest {
  const p = object(value, 'estimationRequest', [
    'methodId',
    'protocolId',
    'protocolVersion',
  ]);
  if (p.methodId !== ESTIMATION_METHOD_ID) fail('estimationRequest.methodId');
  return {
    methodId: ESTIMATION_METHOD_ID,
    protocolId: protocolText(p.protocolId, 'estimationRequest.protocolId'),
    protocolVersion: protocolText(
      p.protocolVersion,
      'estimationRequest.protocolVersion'
    ),
  };
}

/** Omitted request stays omitted; null is not silently normalized. */
export function parseOptionalEstimationRequest(
  value: unknown
): EstimationRequest | undefined {
  return value === undefined ? undefined : parseEstimationRequest(value);
}

function inputs(value: unknown): EstimationInputs {
  const p = object(value, 'estimation.inputs', [
    'effectiveDate',
    'ageYears',
    'unit',
    'skinfolds',
  ]);
  const date = p.effectiveDate;
  if (
    typeof date !== 'string' ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail('estimation.inputs.effectiveDate');
  const age = p.ageYears;
  if (
    age !== null &&
    (typeof age !== 'number' || !Number.isSafeInteger(age) || age < 0)
  ) {
    fail('estimation.inputs.ageYears');
  }
  if (p.unit !== 'mm') fail('estimation.inputs.unit');
  // No variant-specific site selection until the protocol gate is completed.
  if (
    !p.skinfolds ||
    typeof p.skinfolds !== 'object' ||
    Array.isArray(p.skinfolds)
  ) {
    fail('estimation.inputs.skinfolds');
  }
  const fields = Object.keys(p.skinfolds);
  object(p.skinfolds, 'estimation.inputs.skinfolds', fields);
  const skinfolds: Partial<
    Record<(typeof ESTIMATION_SKINFOLD_FIELDS)[number], number>
  > = {};
  for (const [key, raw] of Object.entries(p.skinfolds)) {
    const field = `estimation.inputs.skinfolds.${key}`;
    if (!(ESTIMATION_SKINFOLD_FIELDS as readonly string[]).includes(key))
      fail(field);
    const n = positive(raw, field);
    if (n < 1 || n > 80 || !Number.isInteger(n * 10)) fail(field);
    skinfolds[key as keyof typeof skinfolds] = n;
  }
  return { effectiveDate: date, ageYears: age, unit: 'mm', skinfolds };
}

function result(value: unknown): EstimationResult {
  const p = object(value, 'estimation.result', [
    'sumSkinfoldMm',
    'bodyDensityGPerMl',
    'estimatedBodyFatPercentage',
  ]);
  const percentage = positive(
    p.estimatedBodyFatPercentage,
    'estimation.result.estimatedBodyFatPercentage'
  );
  if (percentage >= 100) fail('estimation.result.estimatedBodyFatPercentage');
  return {
    sumSkinfoldMm: positive(p.sumSkinfoldMm, 'estimation.result.sumSkinfoldMm'),
    bodyDensityGPerMl: positive(
      p.bodyDensityGPerMl,
      'estimation.result.bodyDensityGPerMl'
    ),
    estimatedBodyFatPercentage: percentage,
  };
}

const reasonFields: readonly string[] = [
  'equation',
  'birthDate',
  'effectiveDate',
  ...ESTIMATION_SKINFOLD_FIELDS.map((field) => `measurements.${field}`),
];

function reasons(value: unknown): EstimationReason[] {
  if (!Array.isArray(value)) fail('estimation.reasons');
  return Array.from(value, (raw: unknown, index) => {
    const path = `estimation.reasons.${index}`;
    const p = object(raw, path, ['code', 'fields']);
    if (!(ESTIMATION_REASON_CODES as readonly unknown[]).includes(p.code))
      fail(`${path}.code`);
    if (!Array.isArray(p.fields)) fail(`${path}.fields`);
    const fields = Array.from(p.fields, (field: unknown) => {
      if (typeof field !== 'string' || !reasonFields.includes(field))
        fail(`${path}.fields`);
      return field as EstimationField;
    });
    return { code: p.code as EstimationReason['code'], fields };
  });
}

/**
 * Structural validation only. Does not calculate, select scientific sites, resolve
 * approved versions, assess population/domain, or compare with a parent snapshot.
 * A structurally valid `available` object is NOT an approved clinical result.
 * Not called by current routes, services or repositories.
 */
export function parseEstimationSnapshot(
  value: unknown
): BodyFatEstimationSnapshot {
  const p = object(value, 'estimation', [
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
  ]);
  if (p.schemaVersion !== 1) fail('estimation.schemaVersion');
  if (p.methodId !== ESTIMATION_METHOD_ID) fail('estimation.methodId');
  if (p.provenance !== 'server_estimation') fail('estimation.provenance');
  if (p.variant !== null && p.variant !== 'male' && p.variant !== 'female')
    fail('estimation.variant');
  const variant: EstimationVariant | null = p.variant;
  const formulaVersion =
    p.formulaVersion === null
      ? null
      : text(p.formulaVersion, 'estimation.formulaVersion');
  const domainPolicyVersion =
    p.domainPolicyVersion === null
      ? null
      : text(p.domainPolicyVersion, 'estimation.domainPolicyVersion');
  const parsedInputs = inputs(p.inputs);
  const parsedReasons = reasons(p.reasons);
  const base = {
    schemaVersion: 1 as const,
    methodId: ESTIMATION_METHOD_ID,
    protocol: protocol(p.protocol),
    provenance: 'server_estimation' as const,
  };
  if (p.status === 'available') {
    if (variant === null) fail('estimation.variant');
    if (formulaVersion === null) fail('estimation.formulaVersion');
    if (domainPolicyVersion === null) fail('estimation.domainPolicyVersion');
    if (parsedInputs.ageYears === null) fail('estimation.inputs.ageYears');
    if (Object.keys(parsedInputs.skinfolds).length !== 3)
      fail('estimation.inputs.skinfolds');
    if (parsedReasons.length !== 0) fail('estimation.reasons');
    return {
      ...base,
      status: 'available',
      variant,
      formulaVersion,
      domainPolicyVersion,
      inputs: { ...parsedInputs, ageYears: parsedInputs.ageYears },
      result: result(p.result),
      reasons: [],
    };
  }
  if (p.status !== 'unavailable') fail('estimation.status');
  if (p.result !== null) fail('estimation.result');
  if (parsedReasons.length === 0) fail('estimation.reasons');
  if (variant === null && Object.keys(parsedInputs.skinfolds).length !== 0)
    fail('estimation.inputs.skinfolds');
  return {
    ...base,
    status: 'unavailable',
    variant,
    formulaVersion,
    domainPolicyVersion,
    inputs: parsedInputs,
    result: null,
    reasons: [parsedReasons[0], ...parsedReasons.slice(1)],
  };
}
