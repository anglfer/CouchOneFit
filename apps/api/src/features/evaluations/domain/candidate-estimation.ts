import { calculateCandidateBodyFat } from './body-fat-estimation.js';
import type { AssessmentInput } from './assessment.js';
import {
  CANDIDATE_DOMAIN_VERSION,
  CANDIDATE_FORMULA_VERSION,
  CANDIDATE_PROTOCOLS,
  CANDIDATE_PROTOCOL_VERSION,
  ESTIMATION_METHOD_ID,
  ESTIMATION_SKINFOLD_FIELDS,
  type CandidateBodyFatEstimation,
} from '../types/estimation.js';
import { ageAt } from './assessment.js';
import { defaults } from 'pg';

/** Match pg's URI/query/PGPORT/default precedence without opening a connection. */
function localConnection(
  env: NodeJS.ProcessEnv
): { port: number; database: string } | null {
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    const hosts = ['127.0.0.1', 'localhost', '[::1]', '::1'];
    const hostOverride = url.searchParams.getAll('host').at(-1);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !hosts.includes(url.hostname) ||
      (hostOverride && !hosts.includes(hostOverride))
    )
      return null;
    const value =
      url.searchParams.getAll('port').at(-1) ||
      url.port ||
      env.PGPORT ||
      String(defaults.port);
    const port = Number(value);
    const database = decodeURI(url.pathname.slice(1));
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !database ||
      database === 'postgres'
    )
      return null;
    return { port, database };
  } catch {
    return null;
  }
}

/** Server-only opt-in, fail closed for missing configuration and production. */
export function localCandidateEnvironment(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (
    env.HU023_LOCAL_CANDIDATES_ENABLED !== 'true' ||
    !['development', 'test'].includes(env.NODE_ENV ?? '')
  )
    return false;
  return localConnection(env) !== null;
}

/** Checks the connection itself as well as server configuration before arithmetic. */
export function localCandidateTarget(
  target: { host: string | null; port: number; database: string },
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!localCandidateEnvironment(env)) return false;
  const configured = localConnection(env)!;
  return (
    ['127.0.0.1', '::1'].includes(target.host ?? '') &&
    target.port === configured.port &&
    target.database === configured.database
  );
}

export function isCandidateRequest(input: AssessmentInput): boolean {
  return Object.values(CANDIDATE_PROTOCOLS).some(
    (id) => id === input.estimationRequest?.protocolId
  );
}

/** Only adapter allowed to invoke candidate arithmetic. Never returns `available`. */
export function candidateEstimation(
  input: AssessmentInput,
  birthDate: string | null,
  effectiveDate: string,
  allowed: boolean
): CandidateBodyFatEstimation {
  const variant = input.equation === 'not_applicable' ? null : input.equation;
  const ageYears = ageAt(birthDate, effectiveDate);
  const skinfolds =
    variant === null
      ? {}
      : Object.fromEntries(
          ESTIMATION_SKINFOLD_FIELDS.filter(
            (k) => input.measurements[k] !== undefined
          ).map((k) => [k, input.measurements[k]])
        );
  const blockers = [
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
  const base: CandidateBodyFatEstimation = {
    schemaVersion: 1,
    methodId: ESTIMATION_METHOD_ID,
    variant,
    protocol: {
      id: input.estimationRequest!.protocolId,
      version: CANDIDATE_PROTOCOL_VERSION,
    },
    formulaVersion: null,
    domainPolicyVersion: null,
    technicalFormulaVersion: CANDIDATE_FORMULA_VERSION,
    technicalDomainVersion: CANDIDATE_DOMAIN_VERSION,
    scientificStatus: 'not_validated',
    activationAllowed: false,
    provenance: 'server_estimation',
    inputs: { effectiveDate, ageYears, unit: 'mm', skinfolds },
    blockers,
    status: 'unavailable',
    result: null,
    reasons: [{ code: 'candidate_execution_disabled', fields: [] }],
  };
  if (!allowed) return base;
  const outcome = calculateCandidateBodyFat({
    variant,
    birthDate,
    effectiveDate,
    unit: 'mm',
    skinfolds,
  });
  if (outcome.status === 'unavailable')
    return { ...base, reasons: [outcome.reason] };
  return {
    ...base,
    status: 'candidate_only',
    inputs: outcome.inputs,
    result: outcome.candidateResult,
    reasons: [],
    blockers: outcome.blockers,
  };
}

/** Read-time redaction only; stored candidates are never rewritten or recalculated. */
export function visibleCandidate(
  value: CandidateBodyFatEstimation
): CandidateBodyFatEstimation {
  if (localCandidateEnvironment()) return value;
  return {
    ...value,
    status: 'unavailable',
    result: null,
    reasons: [{ code: 'candidate_execution_disabled', fields: [] }],
  };
}
