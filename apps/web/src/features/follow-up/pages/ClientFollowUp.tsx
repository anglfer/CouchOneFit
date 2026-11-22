import { useEffect, useState } from 'react';
import { Badge, Card, Meter } from '../../../components/ui';
import { useOnSynced, useOperations } from '../../../hooks/useOperations';
import {
  COMPLIANCE_LABEL,
  fetchFollowUp,
  percentLabel,
  submitVisibility,
} from '../services/followUp';
import type {
  AdherenceSummary,
  BodyWeightEntry,
  FollowUp,
  FollowUpSessionSet,
} from '../types/followUp';

const PERIODS = [
  [7, '7 días'],
  [28, '4 semanas'],
  [90, '3 meses'],
] as const;

type FollowUpRange = { days: number } | { from: string; to: string };

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
const kg = (value: number) => `${value.toLocaleString('es-MX')} kg`;
const dash = (value: number | string | null, suffix = '') =>
  value === null ? '—' : `${value}${suffix}`;

const prescribedLabel = (
  set: FollowUpSessionSet,
  loadMode: 'external' | 'bodyweight'
) =>
  [
    set.prescribedRepsMax === null
      ? `${set.prescribedReps} reps`
      : `${set.prescribedReps}–${set.prescribedRepsMax} reps`,
    set.targetLoadKg !== null &&
      !(loadMode === 'bodyweight' && set.targetLoadKg === 0) &&
      `${set.targetLoadKg} kg`,
  ]
    .filter(Boolean)
    .join(' · ');

function AdherenceStat({
  title,
  summary,
}: {
  title: string;
  summary: AdherenceSummary;
}) {
  return (
    <div className="ws-card">
      <p className="ws-stat-label">{title}</p>
      <p className="ws-stat-value">{percentLabel(summary.observedPercent)}</p>
      <p className="ws-stat-note">
        {summary.applicableDays === 0
          ? 'Sin días con plan en el periodo'
          : `Cobertura ${percentLabel(summary.coveragePercent)} · ${summary.recordedDays} de ${summary.applicableDays} días con registro`}
      </p>
      {summary.observedPercent !== null && (
        <Meter value={summary.observedPercent} max={100} label={title} />
      )}
    </div>
  );
}

/** Accessible weight trend with Y-axis ticks and keyboard-focusable points. */
function WeightChart({ entries }: { entries: BodyWeightEntry[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const points = [...entries].sort((a, b) =>
    a.localDate.localeCompare(b.localDate)
  );
  if (points.length < 2) return null;
  const values = points.map((p) => p.weightKg);
  const low = Math.min(...values) - 0.5;
  const high = Math.max(...values) + 0.5;
  const mid = (low + high) / 2;
  const first = Date.parse(`${points[0].localDate}T12:00:00Z`);
  const span = Math.max(
    Date.parse(`${points.at(-1)!.localDate}T12:00:00Z`) - first,
    1
  );
  const x = (p: BodyWeightEntry) =>
    64 + ((Date.parse(`${p.localDate}T12:00:00Z`) - first) / span) * 512;
  const y = (value: number) => 150 - ((value - low) / (high - low)) * 126;
  const selected = points.find((p) => p.checkInId === selectedId) ?? null;

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 600 185"
        className="h-48 w-full"
        role="group"
        aria-label={`Peso corporal de ${kg(points[0].weightKg)} a ${kg(points.at(-1)!.weightKg)} en ${points.length} registros`}
      >
        {[low, mid, high].map((tick) => (
          <g key={tick} aria-hidden="true">
            <line
              x1="60"
              x2="580"
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--ws-border)"
            />
            <text
              x="54"
              y={y(tick) + 4}
              fontSize="11"
              textAnchor="end"
              fill="var(--ws-muted)"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke="var(--ws-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={points.map((p) => `${x(p)},${y(p.weightKg)}`).join(' ')}
        />
        {points.map((p) => (
          <g
            key={p.checkInId}
            role="button"
            tabIndex={0}
            aria-label={`${dateLabel(p.localDate)}: ${kg(p.weightKg)}, check-in del cliente, revisión ${p.revision}`}
            onMouseEnter={() => setSelectedId(p.checkInId)}
            onFocus={() => setSelectedId(p.checkInId)}
            onClick={() => setSelectedId(p.checkInId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedId(p.checkInId);
              }
            }}
            className="cursor-pointer focus:outline-none"
          >
            <circle
              cx={x(p)}
              cy={y(p.weightKg)}
              r="14"
              fill="transparent"
              stroke={
                selectedId === p.checkInId ? 'var(--ws-primary)' : 'transparent'
              }
              strokeWidth="1.5"
            />
            <circle
              cx={x(p)}
              cy={y(p.weightKg)}
              r="4.5"
              fill="var(--ws-primary)"
            >
              <title>
                {dateLabel(p.localDate)} · {kg(p.weightKg)}
              </title>
            </circle>
          </g>
        ))}
        <text
          x="64"
          y="174"
          fontSize="11"
          fill="var(--ws-muted)"
          aria-hidden="true"
        >
          {dateLabel(points[0].localDate)}
        </text>
        <text
          x="576"
          y="174"
          fontSize="11"
          textAnchor="end"
          fill="var(--ws-muted)"
          aria-hidden="true"
        >
          {dateLabel(points.at(-1)!.localDate)}
        </text>
      </svg>
      <p className="text-sm text-(--ws-muted)" aria-live="polite">
        {selected
          ? `${dateLabel(selected.localDate)} · ${kg(selected.weightKg)} · check-in del cliente · rev. ${selected.revision}`
          : 'Pasa el cursor o enfoca un punto para ver el registro exacto.'}
      </p>
    </div>
  );
}

function SharingCard({
  clientId,
  clientName,
  pending,
  data,
  onSaved,
  onRefresh,
}: {
  clientId: string;
  clientName?: string;
  pending?: { measurements?: unknown; adherence?: unknown } | null;
  data: FollowUp;
  onSaved: (next: FollowUp['visibility']) => void;
  onRefresh: () => void;
}) {
  const revisionKey = `${clientId}:${data.visibility.revision}`;
  const [edited, setEdited] = useState<{
    key: string;
    measurements: boolean;
    adherence: boolean;
  } | null>(null);
  const draft =
    edited && edited.key === revisionKey
      ? edited
      : {
          key: revisionKey,
          measurements:
            typeof pending?.measurements === 'boolean'
              ? pending.measurements
              : data.visibility.measurements,
          adherence:
            typeof pending?.adherence === 'boolean'
              ? pending.adherence
              : data.visibility.adherence,
        };
  const [state, setState] = useState<{
    busy: boolean;
    message: string;
    conflictKey: string | null;
  }>({
    busy: false,
    message: '',
    conflictKey: null,
  });

  const hasConflict = state.conflictKey === revisionKey;
  const dirty =
    draft.measurements !== data.visibility.measurements ||
    draft.adherence !== data.visibility.adherence;
  async function save() {
    setState({ busy: true, message: '', conflictKey: null });
    try {
      const outcome = await submitVisibility(
        clientId,
        { measurements: draft.measurements, adherence: draft.adherence },
        data.visibility.revision,
        clientName
      );
      if (outcome.status === 'done') {
        onSaved(outcome.result);
        setState({
          busy: false,
          message: 'Listo. El cliente verá el cambio en su próxima consulta.',
          conflictKey: null,
        });
      } else {
        setState({
          busy: false,
          message:
            'Cambio guardado en este dispositivo. Se enviará al volver la conexión.',
          conflictKey: null,
        });
      }
    } catch (error) {
      const isConflict =
        error instanceof Error && 'status' in error && error.status === 409;
      setState({
        busy: false,
        message: isConflict
          ? 'Otra sesión cambió esta configuración. Actualiza el seguimiento y vuelve a intentarlo.'
          : 'No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.',
        conflictKey: isConflict ? revisionKey : null,
      });
    }
  }
  return (
    <Card
      title="Información compartida con el cliente"
      subtitle="Sus check-ins y su peso siempre los ve: los registró él. Aquí decides qué de lo tuyo ve en su app."
      icon="shield"
      action={pending ? <Badge tone="warn">Pendiente de enviar</Badge> : null}
    >
      <div className="space-y-3">
        {(
          [
            [
              'measurements',
              'Evolución de medidas',
              'Peso, cintura, cadera y grasa de tus evaluaciones.',
            ],
            [
              'adherence',
              'Adherencia',
              'Porcentaje de entrenamiento y alimentación de las últimas 4 semanas.',
            ],
          ] as const
        ).map(([key, label, help]) => (
          <label key={key} className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={draft[key]}
              disabled={state.busy}
              onChange={(e) =>
                setEdited({
                  ...draft,
                  key: revisionKey,
                  [key]: e.target.checked,
                })
              }
            />
            <span>
              <span className="font-semibold">{label}</span>
              <span className="block text-sm text-(--ws-muted)">{help}</span>
            </span>
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            disabled={!dirty || state.busy}
            onClick={() => void save()}
          >
            {state.busy ? 'Guardando…' : 'Guardar'}
          </button>
          {hasConflict && (
            <button type="button" className="ws-btn" onClick={onRefresh}>
              Actualizar configuración
            </button>
          )}
          {state.message && (state.conflictKey === null || hasConflict) && (
            <p role="status" className="text-sm">
              {state.message}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** HU-033: chronological follow-up of one client, without automatic diagnosis. */
export default function ClientFollowUp({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName?: string;
}) {
  const [days, setDays] = useState<number | null>(28);
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' });
  const [appliedRange, setAppliedRange] = useState<FollowUpRange>({ days: 28 });
  const [rangeError, setRangeError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const pendingVisibility = useOperations().find(
    (op) => op.clientId === clientId && op.kind === 'followup.visibility'
  );
  useOnSynced(() => setAttempt((n) => n + 1));
  const [result, setResult] = useState<{
    key: string;
    data: FollowUp | null;
    error: string;
  }>({ key: '', data: null, error: '' });
  const rangeKey =
    'days' in appliedRange
      ? `d:${appliedRange.days}`
      : `r:${appliedRange.from}:${appliedRange.to}`;
  const key = `${clientId}:${rangeKey}:${attempt}`;
  const loading = result.key !== key;

  useEffect(() => {
    let live = true;
    fetchFollowUp(clientId, appliedRange)
      .then((data) => live && setResult({ key, data, error: '' }))
      .catch(
        () =>
          live &&
          setResult({
            key,
            data: null,
            error: 'No pudimos consultar el seguimiento. Reintenta la lectura.',
          })
      );
    return () => {
      live = false;
    };
  }, [clientId, appliedRange, key]);

  function applyCustomRange(e: React.FormEvent) {
    e.preventDefault();
    const { from, to } = customDraft;
    if (!from || !to) {
      setRangeError('Selecciona fecha de inicio y fin.');
      return;
    }
    if (from > to) {
      setRangeError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    const span = Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000
    );
    if (span > 365) {
      setRangeError('El periodo máximo es de 366 días.');
      return;
    }
    setRangeError('');
    setDays(null);
    setAppliedRange({ from, to });
  }

  const data = result.data;
  const weights = data?.bodyWeight ?? [];
  const latest = weights[0];
  const oldest = weights.at(-1);
  const periodDays = data
    ? Math.round(
        (Date.parse(`${data.to}T12:00:00Z`) -
          Date.parse(`${data.from}T12:00:00Z`)) /
          86400000
      ) + 1
    : (days ?? 28);

  return (
    <div className="space-y-5">
      <div className="ws-card flex flex-wrap items-end justify-between gap-4 p-4!">
        <div className="ws-segmented" role="group" aria-label="Periodo">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="ws-plain"
              aria-pressed={days === value}
              onClick={() => {
                setRangeError('');
                setDays(value);
                setAppliedRange({ days: value });
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <details className="rounded-lg border border-(--ws-border-subtle) bg-(--ws-surface-2) px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-(--ws-text-2)">
            Rango personalizado
            {days === null && ' · activo'}
          </summary>
          <form
            onSubmit={applyCustomRange}
            className="mt-3 flex flex-wrap items-end gap-3"
            aria-label="Periodo personalizado"
            noValidate
          >
            <label className="text-sm font-medium">
              Desde
              <input
                type="date"
                className="ws-input mt-1 block min-h-10"
                value={customDraft.from}
                onChange={(e) =>
                  setCustomDraft((d) => ({ ...d, from: e.target.value }))
                }
              />
            </label>
            <label className="text-sm font-medium">
              Hasta
              <input
                type="date"
                className="ws-input mt-1 block min-h-10"
                value={customDraft.to}
                onChange={(e) =>
                  setCustomDraft((d) => ({ ...d, to: e.target.value }))
                }
              />
            </label>
            <button type="submit" className="ws-btn min-h-10">
              Aplicar
            </button>
            {rangeError && (
              <p role="alert" className="text-sm text-(--ws-bad-fg)">
                {rangeError}
              </p>
            )}
          </form>
        </details>
      </div>

      {loading && !data ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Cargando seguimiento…</span>
          <div className="ws-skeleton h-28" />
          <div className="ws-skeleton h-48" />
        </div>
      ) : result.error && !loading ? (
        <div role="alert" className="ws-alert" data-tone="bad">
          <p>{result.error}</p>
          <button
            type="button"
            className="ws-btn"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : (
        data && (
          <div className="space-y-5" aria-busy={loading}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-(--ws-muted)">
              <p>
                Periodo: {dateLabel(data.from)} — {dateLabel(data.to)} ·{' '}
                {data.timeZone}
              </p>
              <a
                href="#compartir-con-cliente"
                className="ws-chip hover:border-(--ws-primary)"
              >
                Visible en app:{' '}
                {data.visibility.measurements || data.visibility.adherence
                  ? [
                      data.visibility.measurements && 'Medidas',
                      data.visibility.adherence && 'Adherencia',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Solo sus check-ins'}
              </a>
            </div>
            <div className="ws-stats">
              <AdherenceStat
                title="Adherencia al entrenamiento"
                summary={data.adherence.training}
              />
              <AdherenceStat
                title="Adherencia a la alimentación"
                summary={data.adherence.nutrition}
              />
              <div className="ws-card">
                <p className="ws-stat-label">Peso corporal</p>
                <p className="ws-stat-value">
                  {latest ? kg(latest.weightKg) : '—'}
                </p>
                <p className="ws-stat-note">
                  {latest && oldest && latest !== oldest
                    ? `${latest.weightKg - oldest.weightKg >= 0 ? '+' : ''}${(latest.weightKg - oldest.weightKg).toFixed(1)} kg desde ${dateLabel(oldest.localDate)}`
                    : latest
                      ? `Registrado ${dateLabel(latest.localDate)}`
                      : 'Sin pesos en el periodo'}
                </p>
              </div>
              <div className="ws-card">
                <p className="ws-stat-label">Check-ins</p>
                <p className="ws-stat-value">
                  {data.checkIns.length}
                  <span className="text-base font-medium text-(--ws-muted)">
                    {' '}
                    / {periodDays} días
                  </span>
                </p>
                <p className="ws-stat-note">
                  {data.checkIns[0]
                    ? `Último: ${dateLabel(data.checkIns[0].localDate)}`
                    : 'Aún no registra check-ins'}
                </p>
              </div>
            </div>
            <p className="text-sm text-(--ws-muted)">
              La adherencia solo cuenta días con plan; descansos y días sin
              registro no cuentan como incumplidos. Son indicadores
              orientativos, no un diagnóstico.
            </p>
            <Card
              title="Peso corporal diario"
              subtitle="Lo registra el cliente en su check-in (kg). Es distinto del peso base y de tus evaluaciones."
              icon="chart"
            >
              {weights.length === 0 ? (
                <p className="text-sm text-(--ws-muted)">
                  Sin pesos registrados en este periodo.
                </p>
              ) : weights.length === 1 ? (
                <p className="text-sm" role="status">
                  Una sola medición: <strong>{kg(weights[0].weightKg)}</strong>{' '}
                  · {dateLabel(weights[0].localDate)} · check-in del cliente
                  (kg). Cuando haya al menos dos registros verás la gráfica.
                </p>
              ) : (
                <WeightChart entries={weights} />
              )}
            </Card>
            <Card title="Check-ins" icon="clipboard">
              {data.checkIns.length === 0 ? (
                <p className="text-sm text-(--ws-muted)">
                  El cliente aún no registra check-ins en este periodo.
                </p>
              ) : (
                <div
                  className="overflow-x-auto rounded-xl border border-(--ws-border)"
                  role="region"
                  aria-label="Check-ins del periodo"
                  tabIndex={0}
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Check-ins del cliente, del más reciente al más antiguo.
                      Estrés, energía y hambre en escala de 1 (bajo) a 5 (alto).
                    </caption>
                    <thead className="bg-(--ws-surface-2)">
                      <tr>
                        {[
                          'Fecha',
                          'Peso',
                          'Sueño',
                          'Estrés',
                          'Energía',
                          'Hambre',
                          'Alimentación',
                          'Comentario',
                        ].map((h) => (
                          <th
                            scope="col"
                            key={h}
                            className="px-3 py-3 font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.checkIns.map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-(--ws-border)"
                        >
                          <th scope="row" className="px-3 py-3 font-normal">
                            {dateLabel(c.localDate)}
                            {c.revision > 1 && (
                              <span className="block text-xs text-(--ws-muted)">
                                Corregido
                              </span>
                            )}
                          </th>
                          <td className="px-3 py-3 tabular-nums">
                            {c.bodyWeightKg === null ? '—' : kg(c.bodyWeightKg)}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {c.sleepHours !== null && c.sleepHours < 6 ? (
                              <span
                                className="font-semibold text-(--ws-warn-fg)"
                                title="Menos de 6 horas"
                              >
                                {dash(c.sleepHours, ' h')}
                              </span>
                            ) : (
                              dash(c.sleepHours, ' h')
                            )}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {c.stress !== null && c.stress >= 4 ? (
                              <span
                                className="font-semibold text-(--ws-bad-fg)"
                                title="Estrés alto"
                              >
                                {dash(c.stress, '/5')}
                              </span>
                            ) : (
                              dash(c.stress, '/5')
                            )}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {c.energy !== null && c.energy <= 2 ? (
                              <span
                                className="font-semibold text-(--ws-warn-fg)"
                                title="Energía baja"
                              >
                                {dash(c.energy, '/5')}
                              </span>
                            ) : c.energy !== null && c.energy >= 4 ? (
                              <span
                                className="font-semibold text-(--ws-ok-fg)"
                                title="Energía alta"
                              >
                                {dash(c.energy, '/5')}
                              </span>
                            ) : (
                              dash(c.energy, '/5')
                            )}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {dash(c.hunger, '/5')}
                          </td>
                          <td className="px-3 py-3">
                            {c.nutritionCompliance ? (
                              <Badge
                                tone={
                                  c.nutritionCompliance === 'completed'
                                    ? 'ok'
                                    : c.nutritionCompliance === 'partial'
                                      ? 'warn'
                                      : 'bad'
                                }
                              >
                                {COMPLIANCE_LABEL[c.nutritionCompliance]}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="max-w-80 px-3 py-3 break-words">
                            {c.comment ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card
              title="Sesiones de entrenamiento del periodo"
              subtitle="Detalle real por ejercicio y serie junto a la versión prescrita."
              icon="dumbbell"
            >
              {data.sessions.length === 0 ? (
                <p className="text-sm text-(--ws-muted)">
                  Sin sesiones de entrenamiento registradas en este periodo.
                </p>
              ) : (
                <div className="space-y-3" data-followup-sessions="true">
                  {data.sessions.map((session) => (
                    <details
                      key={session.id}
                      className="rounded-xl border border-(--ws-border) p-3"
                    >
                      <summary className="cursor-pointer font-semibold">
                        {dateLabel(session.localDate)} · {session.dayName} ·{' '}
                        {session.routineName} v{session.versionNumber} ·{' '}
                        {session.status === 'finalized'
                          ? 'Finalizada'
                          : 'En progreso'}{' '}
                        · {session.performedSets}/{session.totalSets} series
                        realizadas
                      </summary>
                      <div className="mt-3 space-y-4">
                        {session.exercises.map((exercise) => (
                          <div key={exercise.exerciseId} className="space-y-2">
                            <h4 className="text-sm font-semibold">
                              {exercise.name}
                            </h4>
                            <div className="overflow-x-auto rounded-lg border border-(--ws-border)">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-(--ws-surface-2)">
                                  <tr>
                                    {[
                                      'Serie',
                                      'Prescrito',
                                      'Estado',
                                      'Reps',
                                      'Carga',
                                      'RPE',
                                      'RIR',
                                    ].map((h) => (
                                      <th
                                        scope="col"
                                        key={h}
                                        className="px-3 py-2 font-semibold"
                                      >
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {exercise.sets.map((s) => (
                                    <tr
                                      key={s.setId}
                                      className="border-t border-(--ws-border)"
                                    >
                                      <th
                                        scope="row"
                                        className="px-3 py-2 font-normal tabular-nums"
                                      >
                                        {s.ordinal}
                                      </th>
                                      <td className="px-3 py-2 tabular-nums">
                                        {prescribedLabel(s, exercise.loadMode)}
                                      </td>
                                      <td className="px-3 py-2">
                                        {s.state === 'performed'
                                          ? 'Realizada'
                                          : s.state === 'not_performed'
                                            ? 'No realizada'
                                            : 'Sin registrar'}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {s.state === 'performed'
                                          ? (s.reps ?? '—')
                                          : '—'}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {s.state !== 'performed'
                                          ? '—'
                                          : s.unit === 'bodyweight'
                                            ? 'Corporal'
                                            : s.loadKg !== null
                                              ? `${s.loadKg} kg`
                                              : '—'}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {s.rpe ?? '—'}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {s.rir ?? '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
            <div id="compartir-con-cliente" className="scroll-mt-6">
              <SharingCard
                clientId={clientId}
                clientName={clientName}
                pending={pendingVisibility?.body ?? null}
                data={data}
                onSaved={(visibility) =>
                  setResult((r) =>
                    r.data ? { ...r, data: { ...r.data, visibility } } : r
                  )
                }
                onRefresh={() => setAttempt((n) => n + 1)}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}
