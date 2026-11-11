export type Method = 'perimetros' | 'pliegues' | 'bioimpedancia';
export interface AssessmentInput {
  method: Method;
  effectiveDate: string | null;
  equation: 'male' | 'female' | 'not_applicable';
  measurements: Record<string, number>;
  segmental?: {
    type: 'muscle_mass' | 'fat_mass';
    unit: 'kg';
    values: Partial<
      Record<'leftArm' | 'rightArm' | 'trunk' | 'leftLeg' | 'rightLeg', number>
    >;
  };
}
export interface Assessment extends AssessmentInput {
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
      'Captura manual por sitio. Jackson–Pollock pendiente de verificación.',
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
/** Preview only. The API always recomputes the stored result. */
export function preview(input: AssessmentInput): Record<string, number> {
  const m = input.measurements,
    r: Record<string, number> = {};
  if (Object.values(m).some((n) => !Number.isFinite(n) || n <= 0)) return r;
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
