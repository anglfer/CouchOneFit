import {
  candidateSkinfolds,
  type PendingEstimation,
  type CandidateEstimation,
} from './estimation';
export type Method = 'perimetros' | 'pliegues' | 'bioimpedancia';
export interface AssessmentInput {
  method: Method;
  effectiveDate: string | null;
  equation: 'male' | 'female' | 'not_applicable';
  measurements: Record<string, number>;
  estimationRequest?: {
    methodId: 'jackson-pollock-3-siri';
    protocolId:
      'jp3-sites-pending' | 'jp3-male-candidate' | 'jp3-female-candidate';
    protocolVersion: 'technical-reference-v1' | 'technical-candidate-v1';
  };
  segmental?: {
    type: 'muscle_mass' | 'fat_mass';
    unit: 'kg';
    values: Partial<
      Record<'leftArm' | 'rightArm' | 'trunk' | 'leftLeg' | 'rightLeg', number>
    >;
  };
}
export interface Assessment extends AssessmentInput {
  estimation?: PendingEstimation | CandidateEstimation;
  protocol: string;
  ownerId: string;
  ageYears: number | null;
  birthDate: string | null;
  version: string;
  calculationStatus: 'available' | 'partial' | 'pending_verification';
  provenance: 'device_reported' | 'manual_measurements';
  results: Record<string, number>;
}
export const methods: { id: Method; label: string; description: string }[] = [
  {
    id: 'perimetros',
    label: 'Perímetros corporales',
    description:
      'Cintura, abdomen umbilical y proporciones. Navy pendiente de verificación.',
  },
  {
    id: 'pliegues',
    label: 'Pliegues cutáneos',
    description:
      'Captura por sitio. % de grasa con Jackson–Pollock 3 pliegues + Siri.',
  },
  {
    id: 'bioimpedancia',
    label: 'Bioimpedancia',
    description:
      'Valores informados por tu equipo; sin estimaciones de datos ausentes.',
  },
];
export const measurementFields = {
  weightKg: ['Peso', 'kg', 30, 300],
  heightCm: ['Estatura', 'cm', 100, 250],
  waistCm: ['Cintura', 'cm', 40, 250],
  hipCm: ['Cadera', 'cm', 50, 250],
  neckCm: ['Cuello', 'cm', 0.1, undefined],
  abdomenUmbilicalCm: ['Abdomen umbilical', 'cm', 0.1, undefined],
  measuredBodyFatPercentage: ['Grasa corporal medida', '%', 2, 60],
  muscleMassKg: ['Masa muscular', 'kg', 0.1, undefined],
  waterLitres: ['Agua corporal', 'L', 0.1, undefined],
  visceralFatIndex: [
    'Grasa visceral (índice del equipo)',
    'índice',
    0.1,
    undefined,
  ],
  pectoralSkinfoldMm: ['Pliegue pectoral', 'mm', 1, 80],
  abdominalSkinfoldMm: ['Pliegue abdominal', 'mm', 1, 80],
  tricepsSkinfoldMm: ['Pliegue tricipital', 'mm', 1, 80],
  bicepsSkinfoldMm: ['Pliegue bicipital', 'mm', 1, 80],
  subscapularSkinfoldMm: ['Pliegue subescapular', 'mm', 1, 80],
  suprailiacSkinfoldMm: ['Pliegue suprailiaco', 'mm', 1, 80],
  thighSkinfoldMm: ['Pliegue de muslo anterior', 'mm', 1, 80],
} as const;
export type MeasurementField = keyof typeof measurementFields;
export const fieldsByMethod: Record<Method, MeasurementField[]> = {
  perimetros: [
    'weightKg',
    'heightCm',
    'neckCm',
    'waistCm',
    'abdomenUmbilicalCm',
    'hipCm',
  ],
  pliegues: [
    'weightKg',
    'heightCm',
    'tricepsSkinfoldMm',
    'bicepsSkinfoldMm',
    'subscapularSkinfoldMm',
    'suprailiacSkinfoldMm',
    'pectoralSkinfoldMm',
    'abdominalSkinfoldMm',
    'thighSkinfoldMm',
  ],
  bioimpedancia: [
    'weightKg',
    'heightCm',
    'measuredBodyFatPercentage',
    'muscleMassKg',
    'waterLitres',
    'visceralFatIndex',
  ],
};
/** JP3 reference ages: men 18–61, women 18–55 (Jackson & Pollock). */
const skinfoldAgeRange = { male: [18, 61], female: [18, 55] } as const;
const siteNames: Record<string, string> = {
  pectoralSkinfoldMm: 'pectoral',
  abdominalSkinfoldMm: 'abdominal',
  thighSkinfoldMm: 'muslo',
  tricepsSkinfoldMm: 'tríceps',
  suprailiacSkinfoldMm: 'suprailiaco',
};

/** Why JP3 + Siri cannot be estimated yet, in plain Spanish; null when it can. */
export function skinfoldGap(
  equation: AssessmentInput['equation'],
  ageYears: number | null,
  measurements: Record<string, number>
): string | null {
  if (equation === 'not_applicable')
    return 'Elige la ecuación (hombre o mujer) para estimar el % de grasa.';
  const missing = candidateSkinfolds[equation].filter(
    (k) => !(measurements[k] > 0)
  );
  if (missing.length)
    return `Faltan pliegues para el % de grasa: ${missing.map((k) => siteNames[k]).join(', ')}.`;
  if (ageYears === null)
    return 'Sin fecha de nacimiento del cliente: no se puede calcular la edad.';
  const [min, max] = skinfoldAgeRange[equation];
  if (ageYears < min || ageYears > max)
    return `La fórmula aplica de ${min} a ${max} años; el cliente tiene ${ageYears}.`;
  return null;
}

/** Gap first; otherwise the published caution for women over 40. */
export function skinfoldNote(
  equation: AssessmentInput['equation'],
  ageYears: number | null,
  measurements: Record<string, number>
): string | null {
  return (
    skinfoldGap(equation, ageYears, measurements) ??
    (equation === 'female' && ageYears !== null && ageYears > 40
      ? 'Mujer mayor de 40 años: la precisión de la ecuación disminuye; interprétalo con cautela.'
      : null)
  );
}

/** Preview only. The API always recomputes the stored result. */
export function preview(
  input: AssessmentInput,
  ageYears: number | null = null
): Record<string, number> {
  const m = input.measurements,
    r: Record<string, number> = {};
  if (Object.values(m).some((n) => !Number.isFinite(n) || n <= 0)) return r;
  if (
    input.method === 'pliegues' &&
    input.equation !== 'not_applicable' &&
    !skinfoldGap(input.equation, ageYears, m)
  ) {
    const male = input.equation === 'male';
    const sum = candidateSkinfolds[input.equation].reduce(
      (total, k) => total + m[k],
      0
    );
    const density = male
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * ageYears!
      : 1.0994921 -
        0.0009929 * sum +
        0.0000023 * sum ** 2 -
        0.0001392 * ageYears!;
    const fat = 495 / density - 450;
    if (fat > 0 && fat < 100) {
      r.bodyFatPercentage = fat;
      if (m.weightKg) {
        r.fatMassKg = (m.weightKg * fat) / 100;
        r.fatFreeMassKg = m.weightKg - r.fatMassKg;
      }
      r.sumSkinfoldMm = sum;
      r.bodyDensityGPerMl = density;
    }
  }
  if (input.method === 'perimetros') {
    if (m.waistCm && m.hipCm) r.waistHipRatio = m.waistCm / m.hipCm;
    if (m.waistCm && m.heightCm) r.waistHeightRatio = m.waistCm / m.heightCm;
  }
  if (input.method === 'bioimpedancia') {
    if (m.measuredBodyFatPercentage && m.measuredBodyFatPercentage < 100) {
      r.bodyFatPercentage = m.measuredBodyFatPercentage;
      if (m.weightKg) {
        r.fatMassKg = (m.weightKg * m.measuredBodyFatPercentage) / 100;
        r.fatFreeMassKg = m.weightKg - r.fatMassKg;
      }
    }
    if (m.waterLitres && m.weightKg && m.waterLitres <= m.weightKg)
      r.approximateWaterPercentage = (m.waterLitres / m.weightKg) * 100;
  }
  return r;
}
