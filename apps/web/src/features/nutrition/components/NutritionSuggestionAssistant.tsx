import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { confirmDialog } from '../../../services/confirm';
import Modal from '../../training/components/Modal';
import type { ProfessionalRecord } from '../../professional/types/record';
import { requestNutritionSuggestion } from '../services/nutrition';
import type {
  NutritionActivityLevel,
  NutritionBmrFormula,
  NutritionExperience,
  NutritionGoal,
  NutritionMacroPreference,
  NutritionNeatLevel,
  NutritionPace,
  NutritionSex,
  NutritionSuggestionInput,
  NutritionSuggestionResult,
} from '../types/nutrition';
import MacroBar from './MacroBar';

interface Props {
  clientId: string;
  clientName: string;
  record?: ProfessionalRecord | null;
  hasExistingFoodItems: boolean;
  onApply: (result: NutritionSuggestionResult, includeMeals: boolean) => void;
  onClose: () => void;
}

const RESTRICTIONS = [
  'Vegano',
  'Vegetariano',
  'Sin lácteos',
  'Sin pescado',
  'Sin gluten',
];

const GOAL_LABELS: Record<NutritionGoal, string> = {
  fat_loss: 'Pérdida de grasa',
  muscle_gain: 'Ganancia muscular',
  recomposition: 'Recomposición corporal',
  maintenance: 'Mantenimiento',
};

const GOAL_OPTIONS: [NutritionGoal, string][] = [
  ['fat_loss', 'Perder grasa'],
  ['recomposition', 'Recomposición'],
  ['muscle_gain', 'Ganar músculo'],
  ['maintenance', 'Mantener'],
];

const PACE_OPTIONS: [NutritionPace, string][] = [
  ['slow', 'Conservador'],
  ['normal', 'Moderado'],
  ['fast', 'Agresivo'],
];

function computeAge(birthDate: string | null | undefined): number | null {
  const [y, m, d] = (birthDate ?? '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const month = now.getMonth() + 1;
  return (
    now.getFullYear() -
    y -
    (month < m || (month === m && now.getDate() < d) ? 1 : 0)
  );
}

function inferGoal(goalText: string | null | undefined): NutritionGoal {
  const g = (goalText ?? '').toLowerCase();
  if (/grasa|defin|bajar|perder|cut/.test(g)) return 'fat_loss';
  if (/musc|volum|hipertrof|ganar|bulk/.test(g)) return 'muscle_gain';
  if (/manten/.test(g)) return 'maintenance';
  return 'recomposition';
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const toNumber = (raw: string) => {
  const n = Number(raw.replace(',', '.'));
  return raw.trim() && Number.isFinite(n) ? n : null;
};

export default function NutritionSuggestionAssistant({
  clientId,
  clientName,
  record,
  hasExistingFoodItems,
  onApply,
  onClose,
}: Props) {
  // Latest evaluation first, then the base profile. Nothing is invented.
  const prefill = useMemo(() => {
    const profile = record?.profile;
    const evaluations =
      record?.sections.evaluations.status === 'available'
        ? record.sections.evaluations.evaluations
        : [];
    const latest = evaluations[0] ?? null;
    // Newest evaluation that actually has the value, then the base profile.
    const pickValue = (
      read: (e: (typeof evaluations)[number]) => number | null | undefined,
      fromProfile: number | null | undefined
    ): [number | null, string] => {
      const source = evaluations.find((e) => read(e) != null);
      if (source) {
        const method =
          source.assessment?.method === 'pliegues'
            ? 'Pliegues'
            : source.assessment?.method === 'bioimpedancia'
              ? 'Bioimpedancia'
              : 'Evaluación';
        return [
          Math.round(read(source)! * 10) / 10,
          `${method} · ${shortDate(source.evaluationDate)}`,
        ];
      }
      return fromProfile != null
        ? [fromProfile, 'Perfil base']
        : [null, 'Sin dato: captúralo'];
    };

    const [weightKg, weightOrigin] = pickValue(
      (e) => e.weightKg ?? e.assessment?.measurements.weightKg,
      profile?.baseWeightKg
    );
    const [heightCm, heightOrigin] = pickValue(
      (e) => e.assessment?.measurements.heightCm,
      profile?.heightCm
    );
    const [bodyFatPct, bfOrigin] = pickValue(
      (e) =>
        e.measuredBodyFatPercentage ?? e.assessment?.results.bodyFatPercentage,
      profile?.baseBodyFatPercentage
    );
    const evalLabel = latest
      ? `Evaluación ${shortDate(latest.evaluationDate)}`
      : '';
    const equation = latest?.assessment?.equation;
    const sex: NutritionSex | null =
      equation === 'male' || equation === 'female' ? equation : null;

    const trainingSection = record?.sections.trainingPlan;
    const routineDays =
      trainingSection?.status === 'available'
        ? trainingSection.plan.days.filter((d) => d.kind === 'training').length
        : 0;

    return {
      ageYears: computeAge(profile?.birthDate),
      weightKg,
      weightOrigin,
      heightCm,
      heightOrigin,
      bodyFatPct,
      bfOrigin: bodyFatPct == null ? 'Opcional' : bfOrigin,
      sex,
      sexOrigin: sex ? evalLabel : 'Elige la ecuación de referencia',
      goal: inferGoal(profile?.goal),
      trainingDaysPerWeek: routineDays
        ? Math.max(1, Math.min(7, routineDays))
        : 4,
      trainingOrigin: routineDays ? 'Rutina activa' : 'Ajustable',
    };
  }, [record]);

  const [sex, setSex] = useState<NutritionSex | null>(prefill.sex);
  const [ageRaw, setAgeRaw] = useState(String(prefill.ageYears ?? ''));
  const [weightRaw, setWeightRaw] = useState(String(prefill.weightKg ?? ''));
  const [heightRaw, setHeightRaw] = useState(String(prefill.heightCm ?? ''));
  const [bodyFatRaw, setBodyFatRaw] = useState(
    prefill.bodyFatPct != null ? String(prefill.bodyFatPct) : ''
  );
  const [formulaChoice, setFormulaChoice] =
    useState<NutritionBmrFormula | null>(null);
  const [activityLevel, setActivityLevel] =
    useState<NutritionActivityLevel>('moderate');
  const [neatLevel, setNeatLevel] = useState<NutritionNeatLevel>('medium');
  const [experience, setExperience] =
    useState<NutritionExperience>('intermediate');
  const [goal, setGoal] = useState<NutritionGoal>(prefill.goal);
  const [pace, setPace] = useState<NutritionPace>('normal');
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(
    prefill.trainingDaysPerWeek
  );
  const [sessionDurationMin, setSessionDurationMin] = useState<number>(60);
  const [macroPreference, setMacroPreference] =
    useState<NutritionMacroPreference>('balanced');
  const [enableCarbCycling, setEnableCarbCycling] = useState<boolean>(
    prefill.goal === 'fat_loss' || prefill.goal === 'recomposition'
  );
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [customAdjRaw, setCustomAdjRaw] = useState<string>('');
  const [customProtRaw, setCustomProtRaw] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionSuggestionResult | null>(null);
  const requestId = useRef(0);

  const ageYears = toNumber(ageRaw);
  const weightKg = toNumber(weightRaw);
  const heightCm = toNumber(heightRaw);
  const bodyFat = toNumber(bodyFatRaw);
  const hasBf = bodyFat != null;
  const formula: NutritionBmrFormula =
    formulaChoice ?? (hasBf ? 'katch_mcardle' : 'mifflin');

  const toggleRestriction = (item: string) => {
    setRestrictions((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  // Client-side checks mirror the API validator so the preview never lies.
  const inputProblem = !sex
    ? 'Elige la ecuación de referencia (mujer u hombre) para calcular.'
    : weightKg == null || weightKg < 30 || weightKg > 300
      ? 'Captura un peso entre 30 y 300 kg.'
      : heightCm == null || heightCm < 100 || heightCm > 250
        ? 'Captura una estatura entre 100 y 250 cm.'
        : ageYears == null || ageYears < 16 || ageYears > 100
          ? 'La edad debe estar entre 16 y 100 años.'
          : bodyFatRaw.trim() &&
              (bodyFat == null || bodyFat < 3 || bodyFat > 65)
            ? 'El % de grasa debe estar entre 3 y 65.'
            : formula === 'katch_mcardle' && !hasBf
              ? 'Katch-McArdle necesita % de grasa.'
              : null;

  const payload = useMemo<NutritionSuggestionInput | null>(() => {
    if (inputProblem || !sex) return null;
    const adj = toNumber(customAdjRaw);
    const prot = toNumber(customProtRaw);
    return {
      sex,
      ageYears: Math.round(ageYears!),
      weightKg: Math.round(weightKg! * 10) / 10,
      heightCm: Math.round(heightCm! * 10) / 10,
      bodyFatPct: bodyFat != null ? Math.round(bodyFat * 10) / 10 : null,
      formula,
      activityLevel,
      neatLevel,
      experience,
      goal,
      pace,
      trainingDaysPerWeek,
      sessionDurationMin,
      macroPreference,
      enableCarbCycling: enableCarbCycling && trainingDaysPerWeek < 7,
      restrictions,
      customAdjustmentPct: adj,
      customProteinPerKg: prot,
    };
  }, [
    inputProblem,
    sex,
    ageYears,
    weightKg,
    heightCm,
    bodyFat,
    formula,
    activityLevel,
    neatLevel,
    experience,
    goal,
    pace,
    trainingDaysPerWeek,
    sessionDurationMin,
    macroPreference,
    enableCarbCycling,
    restrictions,
    customAdjRaw,
    customProtRaw,
  ]);

  // Live preview: recalculates shortly after each change.
  useEffect(() => {
    if (!payload) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setBusy(true);
      requestNutritionSuggestion(clientId, payload)
        .then((calculated) => {
          if (id !== requestId.current) return;
          setResult(calculated);
          setError(null);
        })
        .catch((err) => {
          if (id !== requestId.current) return;
          setError(
            err instanceof Error
              ? err.message
              : 'No pudimos calcular la sugerencia nutricional.'
          );
        })
        .finally(() => {
          if (id === requestId.current) setBusy(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [clientId, payload]);

  async function handleApply(includeMeals: boolean) {
    if (!result) return;
    if (includeMeals && hasExistingFoodItems) {
      const ok = await confirmDialog({
        title: '¿Reemplazar tiempos de comida actuales?',
        message:
          'Ya capturaste alimentos en este borrador. Si aplicas la estructura sugerida se reemplazarán las comidas actuales por los tiempos propuestos. Puedes conservar tus comidas si eliges "Solo objetivos y guía".',
        confirmLabel: 'Reemplazar comidas',
        cancelLabel: 'Cancelar',
        danger: true,
      });
      if (!ok) return;
    }
    onApply(result, includeMeals);
    onClose();
  }

  return (
    <Modal
      wide
      title={`Asistente nutricional · ${clientName}`}
      subtitle="Calcula metas con los datos de su última evaluación y propone comidas con alimentos. Tú decides: nada se guarda ni se activa hasta que lo apruebes."
      onClose={onClose}
    >
      <div className="nutrition-assistant-layout">
        <div className="nutrition-assistant-form">
          <div className="nutrition-assistant-block">
            <span className="ws-eyebrow">DATOS DEL CLIENTE</span>
            <div className="nutrition-assistant-grid">
              <div className="nutrition-fact">
                <span className="nutrition-mini-label">
                  Ecuación de referencia
                </span>
                <div className="nutrition-group-pills" role="group">
                  {(
                    [
                      ['female', 'Mujer'],
                      ['male', 'Hombre'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className="ws-plain nutrition-group-pill"
                      aria-pressed={sex === value}
                      onClick={() => setSex(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <small data-missing={!sex || undefined}>
                  {sex && sex !== prefill.sex
                    ? 'Elegida por ti'
                    : prefill.sexOrigin}
                </small>
              </div>

              {(
                [
                  [
                    'Peso (kg)',
                    weightRaw,
                    setWeightRaw,
                    prefill.weightOrigin,
                    0.1,
                  ],
                  [
                    'Estatura (cm)',
                    heightRaw,
                    setHeightRaw,
                    prefill.heightOrigin,
                    0.1,
                  ],
                  [
                    '% grasa corporal',
                    bodyFatRaw,
                    setBodyFatRaw,
                    prefill.bfOrigin,
                    0.1,
                  ],
                ] as const
              ).map(([label, raw, set, origin, step]) => (
                <label key={label} className="nutrition-fact">
                  {label}
                  <input
                    type="number"
                    step={step}
                    value={raw}
                    onChange={(e) => set(e.target.value)}
                  />
                  <small data-missing={!raw.trim() || undefined}>
                    {raw.trim() ? origin : 'Sin dato: captúralo'}
                  </small>
                </label>
              ))}
              {prefill.ageYears !== null ? (
                // The API also derives age from the birth date; not editable here.
                <div className="nutrition-fact">
                  <span className="nutrition-mini-label">Edad</span>
                  <strong>{prefill.ageYears} años</strong>
                  <small>Según su fecha de nacimiento</small>
                </div>
              ) : (
                <label className="nutrition-fact">
                  Edad (años)
                  <input
                    type="number"
                    step={1}
                    value={ageRaw}
                    onChange={(e) => setAgeRaw(e.target.value)}
                  />
                  <small data-missing>
                    Sin fecha de nacimiento: captúrala en el perfil
                  </small>
                </label>
              )}
            </div>
          </div>

          <div className="nutrition-assistant-block">
            <span className="ws-eyebrow">OBJETIVO Y ACTIVIDAD</span>
            <div className="nutrition-fact">
              <span className="nutrition-mini-label">Objetivo</span>
              <div className="nutrition-group-pills" role="group">
                {GOAL_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="ws-plain nutrition-group-pill"
                    aria-pressed={goal === value}
                    onClick={() => {
                      setGoal(value);
                      if (value === 'muscle_gain') setEnableCarbCycling(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="nutrition-fact">
              <span className="nutrition-mini-label">Ritmo</span>
              <div className="nutrition-group-pills" role="group">
                {PACE_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="ws-plain nutrition-group-pill"
                    aria-pressed={pace === value}
                    onClick={() => setPace(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="nutrition-assistant-grid">
              <label>
                Actividad y entrenamiento
                <select
                  value={activityLevel}
                  onChange={(e) =>
                    setActivityLevel(e.target.value as NutritionActivityLevel)
                  }
                >
                  <option value="sedentary">Sedentario / entreno ligero</option>
                  <option value="light">Actividad leve</option>
                  <option value="moderate">Actividad moderada</option>
                  <option value="very_active">
                    Muy activo / trabajo físico
                  </option>
                </select>
              </label>
              <label>
                Días de entreno por semana
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={trainingDaysPerWeek}
                  onChange={(e) =>
                    setTrainingDaysPerWeek(
                      Math.max(1, Math.min(7, Number(e.target.value) || 1))
                    )
                  }
                />
                <small>{prefill.trainingOrigin}</small>
              </label>
            </div>

            <div className="nutrition-fact">
              <span className="nutrition-mini-label">
                Restricciones o patrón alimentario
              </span>
              <div className="nutrition-group-pills">
                {RESTRICTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="ws-plain nutrition-group-pill"
                    aria-pressed={restrictions.includes(item)}
                    onClick={() => toggleRestriction(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <details className="nutrition-accordion">
              <summary>Ajustes finos (opcional)</summary>
              <div className="nutrition-accordion-body">
                <div className="nutrition-assistant-grid">
                  <label>
                    Movimiento diario (NEAT)
                    <select
                      value={neatLevel}
                      onChange={(e) =>
                        setNeatLevel(e.target.value as NutritionNeatLevel)
                      }
                    >
                      <option value="low">Bajo (&lt;5,000 pasos)</option>
                      <option value="medium">Medio (5,000–9,000 pasos)</option>
                      <option value="high">Alto (&gt;9,000 pasos)</option>
                    </select>
                  </label>
                  <label>
                    Experiencia entrenando
                    <select
                      value={experience}
                      onChange={(e) =>
                        setExperience(e.target.value as NutritionExperience)
                      }
                    >
                      <option value="beginner">Principiante</option>
                      <option value="intermediate">Intermedio</option>
                      <option value="advanced">Avanzado</option>
                    </select>
                  </label>
                  <label>
                    Preferencia de energía
                    <select
                      value={macroPreference}
                      onChange={(e) =>
                        setMacroPreference(
                          e.target.value as NutritionMacroPreference
                        )
                      }
                    >
                      <option value="balanced">Equilibrado</option>
                      <option value="higher_carbs">Más carbohidratos</option>
                      <option value="higher_fat">Más grasas (20–35%)</option>
                    </select>
                  </label>
                  <label>
                    Duración de sesión (min)
                    <input
                      type="number"
                      min={20}
                      max={180}
                      step={5}
                      value={sessionDurationMin}
                      onChange={(e) =>
                        setSessionDurationMin(
                          Math.max(
                            20,
                            Math.min(180, Number(e.target.value) || 60)
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Fórmula de gasto basal
                    <select
                      value={formula}
                      onChange={(e) =>
                        setFormulaChoice(e.target.value as NutritionBmrFormula)
                      }
                    >
                      <option value="mifflin">Mifflin-St Jeor</option>
                      <option value="katch_mcardle" disabled={!hasBf}>
                        Katch-McArdle (requiere % grasa)
                      </option>
                    </select>
                  </label>
                  <label>
                    Ajuste calórico (% sobre gasto)
                    <input
                      type="number"
                      min={-35}
                      max={35}
                      step={0.5}
                      value={customAdjRaw}
                      onChange={(e) => setCustomAdjRaw(e.target.value)}
                      placeholder="Automático"
                    />
                  </label>
                  <label>
                    Proteína (g/kg)
                    <input
                      type="number"
                      min={0.8}
                      max={3.5}
                      step={0.1}
                      value={customProtRaw}
                      onChange={(e) => setCustomProtRaw(e.target.value)}
                      placeholder="Automática"
                    />
                  </label>
                </div>
                <label className="nutrition-check-row">
                  <input
                    type="checkbox"
                    checked={enableCarbCycling}
                    disabled={trainingDaysPerWeek >= 7}
                    onChange={(e) => setEnableCarbCycling(e.target.checked)}
                  />
                  <span>
                    Ciclado de carbohidratos (−20% en días de descanso, mismo
                    promedio semanal)
                  </span>
                </label>
              </div>
            </details>
          </div>

          {(inputProblem || error) && (
            <div
              className="ws-alert"
              data-tone={error ? 'bad' : 'warn'}
              role="alert"
            >
              {error ?? inputProblem}
            </div>
          )}
        </div>

        <aside
          className="nutrition-assistant-result"
          aria-live="polite"
          aria-busy={busy}
        >
          {!result ? (
            <div className="nutrition-assistant-placeholder">
              <Icon name="bowl" size={28} />
              <strong>{busy ? 'Calculando…' : 'Vista previa'}</strong>
              <p>
                {inputProblem
                  ? 'Completa los datos marcados y el cálculo aparecerá aquí al instante.'
                  : 'Calculando gasto energético, macros y comidas sugeridas.'}
              </p>
            </div>
          ) : (
            <div
              className="nutrition-result-stack"
              data-stale={busy || undefined}
            >
              <div className="nutrition-energy-strip">
                <div>
                  <span>
                    BMR (
                    {result.formulaUsed === 'katch_mcardle'
                      ? 'Katch'
                      : 'Mifflin'}
                    )
                  </span>
                  <strong>{result.bmr} kcal</strong>
                </div>
                <div>
                  <span>TDEE (×{result.activityMultiplier})</span>
                  <strong>{result.tdee} kcal</strong>
                </div>
                <div>
                  <span>Ajuste</span>
                  <strong>
                    {result.adjustmentPct > 0
                      ? `+${result.adjustmentPct}`
                      : result.adjustmentPct}
                    %
                  </strong>
                </div>
                {result.leanBodyMassKg !== null && (
                  <div>
                    <span>Masa magra / FFMI</span>
                    <strong>
                      {result.leanBodyMassKg} kg · {result.ffmi}
                    </strong>
                  </div>
                )}
              </div>

              {result.recommendedPhase &&
                result.recommendedPhase.goal !== goal && (
                  <div className="ws-alert" data-tone="info">
                    <strong>
                      Sugerencia orientativa (
                      {GOAL_LABELS[result.recommendedPhase.goal]}):
                    </strong>{' '}
                    {result.recommendedPhase.reason}
                  </div>
                )}

              {result.safetyNotice && (
                <div className="ws-alert" data-tone="warn">
                  <strong>Límite de seguridad:</strong> {result.safetyNotice}
                </div>
              )}

              <MacroBar
                label={
                  result.restDayTargets
                    ? 'Días de entreno (objetivo)'
                    : 'Objetivos diarios sugeridos'
                }
                caloriesTarget={result.trainingDayTargets.caloriesTarget}
                proteinG={result.trainingDayTargets.proteinTargetG}
                carbsG={result.trainingDayTargets.carbsTargetG}
                fatG={result.trainingDayTargets.fatTargetG}
              />

              {result.restDayTargets && (
                <MacroBar
                  compact
                  label={`Días de descanso (promedio sem. ${result.weeklyAverageCalories} kcal)`}
                  caloriesTarget={result.restDayTargets.caloriesTarget}
                  proteinG={result.restDayTargets.proteinTargetG}
                  carbsG={result.restDayTargets.carbsTargetG}
                  fatG={result.restDayTargets.fatTargetG}
                />
              )}

              <div className="nutrition-result-chips">
                <span>Fibra: {result.fiberTargetG} g/día</span>
                <span>
                  Hidratación: {(result.hydrationTargetMl / 1000).toFixed(1)} L
                </span>
                <span>Proteína: {result.proteinPerKg} g/kg</span>
                <span>
                  {result.mealDistribution.mealsPerDay} comidas · ~
                  {result.mealDistribution.proteinPerMealG} g prot/comida
                </span>
              </div>

              <div className="nutrition-result-notes">
                <p>
                  <strong>Leucina y ritmo:</strong>{' '}
                  {result.mealDistribution.leucineNote}
                </p>
                <p>
                  <strong>Peri-entreno:</strong> Pre{' '}
                  {result.periWorkout.preProteinG}g P /{' '}
                  {result.periWorkout.preCarbsG}g C · Post{' '}
                  {result.periWorkout.postProteinG}g P /{' '}
                  {result.periWorkout.postCarbsG}g C
                  {result.periWorkout.intraCarbsG > 0
                    ? ` · Intra ${result.periWorkout.intraCarbsG}g C`
                    : ''}
                </p>
              </div>

              <p className="nutrition-authority-note">
                Nada se guarda ni se activa todavía. Al usar la propuesta podrás
                cambiar cualquier caloría, alimento o porción antes de
                publicarla.
              </p>

              <div className="nutrition-result-actions">
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => void handleApply(false)}
                >
                  Solo metas
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => void handleApply(true)}
                >
                  <Icon name="sparkle" size={15} /> Usar plan con{' '}
                  {result.suggestedMeals.length} comidas y alimentos
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
