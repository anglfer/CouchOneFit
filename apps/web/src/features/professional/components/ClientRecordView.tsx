import { Icon } from '../../../components/Icon';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../../components/Link';
import { Badge, Card } from '../../../components/ui';
import { useOnSynced, useOperations } from '../../../hooks/useOperations';
import type { Operation } from '../../../services/offline/outbox';
import RoutineWeek from '../../training/components/RoutineWeek';
import ClientTraining from '../../training/pages/ClientTraining';
import ClientNutrition from '../../nutrition/pages/ClientNutrition';
import EvaluationsPage from '../../evaluations/pages/EvaluationsPage';
import ClientFollowUp from '../../follow-up/pages/ClientFollowUp';
import {
  count,
  relativeDay,
  routineStats,
  scheduleLabel,
} from '../../training/services/training';
import { fetchProfessionalRecord } from '../services/record';
import type { ClientBaseRecord } from '../types/portfolio';
import type { ProfessionalRecord } from '../types/record';
import ClientRecordEditor from './ClientRecordEditor';
import ClientStatusAction from './ClientStatusAction';
import ClientBaseDetails from './ClientBaseDetails';
import { latestBodyFat } from '../../evaluations/types/evaluation';
import ClientHeader, { type ClientTab } from './ClientHeader';
import ClientRecordSections, { SectionState } from './ClientRecordSections';

/** Muestra el expediente con los cambios hechos sin conexión que aún no se envían. */
function applyPending(
  record: ClientBaseRecord,
  operations: Operation[]
): ClientBaseRecord {
  return operations.reduce((merged, operation) => {
    const { version: _version, ...changes } = operation.body;
    return operation.kind === 'client.edit' ||
      operation.kind === 'client.status'
      ? ({ ...merged, ...changes } as ClientBaseRecord)
      : merged;
  }, record);
}

type Props = {
  clientId: string;
  accountId: string;
  active: ClientTab;
  capture: boolean;
  onStatusChanged: () => void;
  sessionReady: boolean;
};

export default function ClientRecordView(props: Props) {
  return (
    <ClientRecordContent
      key={`${props.accountId}:${props.clientId}`}
      {...props}
    />
  );
}

function ClientRecordContent({
  clientId,
  accountId,
  active,
  capture,
  onStatusChanged,
  sessionReady,
}: Props) {
  const [result, setResult] = useState<{
    attempt: number;
    record: ProfessionalRecord | null;
    error: string;
  }>({ attempt: -1, record: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<ClientTab | 'capture' | null>(null);
  const [saved, setSaved] = useState(false);
  const [statusSaved, setStatusSaved] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const panel = capture ? 'capture' : active;
  const isEditing = editing === panel;
  if (editing && !isEditing) setEditing(null);
  const loading = result.attempt !== attempt;
  const stored = result.record?.profile;
  const pendingHere = useOperations().filter(
    (operation) =>
      operation.clientId === clientId &&
      ['client.edit', 'client.status'].includes(operation.kind)
  );
  const hasPending = pendingHere.length > 0;
  const record =
    stored && hasPending ? applyPending(stored, pendingHere) : stored;
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const revealNotice = useCallback((node: HTMLParagraphElement | null) => {
    node?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  useOnSynced(refresh);
  useEffect(() => {
    const close = (event: PointerEvent) =>
      document
        .querySelectorAll<HTMLDetailsElement>('details.ws-actions-menu[open]')
        .forEach((menu) => {
          if (!menu.contains(event.target as Node)) menu.open = false;
        });
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const error = loading ? '' : result.error;
  const sections = result.record?.sections;
  useEffect(() => {
    let active = true;
    void fetchProfessionalRecord(clientId)
      .then((record) => {
        if (active) {
          setResult((current) => {
            const latest = current.record?.profile;
            return {
              attempt,
              record:
                latest && latest.version > record.profile.version
                  ? { ...record, profile: latest }
                  : record,
              error: '',
            };
          });
        }
      })
      .catch(() => {
        if (active)
          setResult({
            attempt,
            record: null,
            error:
              'No pudimos consultar el expediente. Puede no estar disponible o haber un problema de conexión.',
          });
      });
    return () => {
      active = false;
    };
  }, [clientId, attempt]);
  function updateProfile(profile: ClientBaseRecord) {
    setResult((current) =>
      current.record
        ? { ...current, record: { ...current.record, profile } }
        : current
    );
  }
  return (
    <section className="client-hub space-y-5">
      {record ? (
        <ClientHeader
          clientId={clientId}
          name={record.fullName}
          active={active}
          badges={
            <>
              <Badge tone={record.status === 'active' ? 'ok' : 'neutral'}>
                {record.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
              {sections && <RoutineBadge section={sections.trainingPlan} />}
              {sections && <NutritionBadge section={sections.nutritionPlan} />}
            </>
          }
          facts={[
            age(record.birthDate),
            record.heightCm === null ? '' : `${record.heightCm} cm`,
            record.baseWeightKg === null ? '' : `${record.baseWeightKg} kg`,
            record.goal ?? '',
          ].filter(Boolean)}
          actions={
            <>
              <button
                type="button"
                className="ws-btn"
                disabled={isEditing || loading || statusBusy || hasPending}
                onClick={() => {
                  setSaved(false);
                  setEditing(panel);
                }}
              >
                Editar datos base
              </button>
              <details className="ws-actions-menu">
                <summary className="ws-btn">
                  Más acciones <Icon name="chevron-down" size={16} />
                </summary>
                <div className="ws-actions-menu-body">
                  <button
                    type="button"
                    className="ws-btn"
                    disabled={isEditing || loading || statusBusy}
                    onClick={refresh}
                    title="Vuelve a leer los datos del servidor"
                  >
                    <Icon name="refresh" size={16} />
                    Actualizar expediente
                  </button>
                  <Link to="/app/clientes" className="ws-btn">
                    <Icon name="key" size={16} />
                    Gestionar acceso en Clientes
                  </Link>
                  <ClientStatusAction
                    sessionReady={sessionReady}
                    clientId={clientId}
                    status={record.status}
                    accountId={accountId}
                    disabled={isEditing || loading || hasPending}
                    onQueued={() =>
                      setStatusSaved(
                        'Los cambios se guardaron en este dispositivo y se enviarán cuando haya conexión.'
                      )
                    }
                    onBusyChange={setStatusBusy}
                    onChanged={(updated) => {
                      updateProfile(updated);
                      setStatusSaved(
                        updated.status === 'active'
                          ? 'El expediente está activo.'
                          : 'El expediente está inactivo.'
                      );
                      onStatusChanged();
                    }}
                  />
                </div>
              </details>
            </>
          }
        />
      ) : (
        <Link to="/app/clientes" className="client-hub-back">
          <Icon name="arrow-right" size={16} className="rotate-180" />
          Clientes
        </Link>
      )}
      {[saved && 'Los cambios se guardaron correctamente.', statusSaved]
        .filter(Boolean)
        .map((notice) => (
          <p
            key={notice as string}
            role="status"
            ref={revealNotice}
            className="ws-alert"
            data-tone="ok"
          >
            <Icon name="check" size={16} className="inline align-[-3px]" />{' '}
            {notice}
          </p>
        ))}
      {loading && !record ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Cargando expediente…</span>
          <div className="ws-skeleton h-24" />
          <div className="ws-skeleton h-40" />
        </div>
      ) : error ? (
        <div role="alert" className="ws-alert" data-tone="bad">
          <p>
            {active === 'evaluation'
              ? 'No pudimos consultar este expediente. Comprueba el acceso o reintenta.'
              : error}
          </p>
          <button type="button" className="ws-btn" onClick={refresh}>
            Reintentar lectura
          </button>
        </div>
      ) : (
        record &&
        result.record &&
        sections && (
          <div
            className="client-hub-panel min-w-0 space-y-5"
            key={active}
            aria-busy={loading}
          >
            {isEditing && (
              <ClientRecordEditor
                accountId={accountId}
                initial={record}
                onCancel={() => setEditing(null)}
                onQueued={() => {
                  setEditing(null);
                  setSaved(false);
                  setStatusSaved(
                    'Los cambios se guardaron en este dispositivo y se enviarán cuando haya conexión.'
                  );
                }}
                onSaved={(updated) => {
                  updateProfile(updated);
                  setEditing(null);
                  setSaved(true);
                }}
              />
            )}
            <div hidden={isEditing} className="space-y-5">
              {active === 'training' ? (
                <div className="training-page">
                  <ClientTraining
                    clientId={clientId}
                    clientName={record.fullName}
                    onActivated={refresh}
                  />
                </div>
              ) : active === 'evaluation' ? (
                <EvaluationsPage
                  clientId={clientId}
                  accountId={accountId}
                  capture={capture}
                  record={result.record}
                  recordRevision={result.attempt}
                  refresh={refresh}
                />
              ) : active === 'followUp' ? (
                <ClientFollowUp clientId={clientId} />
              ) : active === 'nutrition' ? (
                <div className="training-page">
                  <ClientNutrition
                    clientId={clientId}
                    clientName={record.fullName}
                    record={result.record}
                    onActivated={refresh}
                  />
                </div>
              ) : (
                <>
                  {hasPending && (
                    <p className="ws-alert" data-tone="warn" role="status">
                      Este expediente tiene cambios pendientes de enviar. Se
                      muestran aquí tal como los capturaste.{' '}
                      <Link
                        to="/app/pendientes"
                        className="font-semibold underline"
                      >
                        Ver pendientes
                      </Link>
                    </p>
                  )}
                  <CrossModuleStats
                    record={record}
                    sections={sections}
                    clientId={clientId}
                  />
                  <div className="client-hub-grid">
                    <RoutineCard
                      section={sections.trainingPlan}
                      clientId={clientId}
                    />
                    <Card title="Perfil y medidas base" icon="user">
                      <div className="space-y-4">
                        <ClientBaseDetails
                          record={record}
                          currentFat={latestBodyFat(sections.evaluations)}
                        />
                      </div>
                    </Card>
                  </div>
                  <ClientRecordSections
                    sections={sections}
                    clientId={clientId}
                  />
                </>
              )}
            </div>
          </div>
        )
      )}
    </section>
  );
}

type TrainingSection = ProfessionalRecord['sections']['trainingPlan'];

function age(birthDate: string | null): string {
  if (!birthDate) return '';
  const [y, m, d] = birthDate.split('-').map(Number);
  const now = new Date();
  const month = now.getMonth() + 1;
  const years =
    now.getFullYear() -
    y -
    (month < m || (month === m && now.getDate() < d) ? 1 : 0);
  return `${years} años`;
}

function RoutineBadge({ section }: { section: TrainingSection }) {
  if (section.status === 'available')
    return <Badge tone="ok">Rutina activa</Badge>;
  if (section.status === 'empty') return <Badge tone="warn">Sin rutina</Badge>;
  return null;
}

type NutritionSection = ProfessionalRecord['sections']['nutritionPlan'];

function NutritionBadge({ section }: { section: NutritionSection }) {
  if (section.status === 'available')
    return <Badge tone="ok">Plan alimenticio activo</Badge>;
  if (section.status === 'empty')
    return <Badge tone="warn">Sin plan alimenticio</Badge>;
  return null;
}

/** Balanced cross-module KPI row for active sections without duplicating alerts. */
function CrossModuleStats({
  record,
  sections,
  clientId,
}: {
  record: ClientBaseRecord;
  sections: ProfessionalRecord['sections'];
  clientId: string;
}) {
  const cards: React.ReactElement[] = [];

  if (sections.trainingPlan.status === 'available') {
    const stats = routineStats(sections.trainingPlan.plan);
    const activity = sections.trainingPlan.activity;
    cards.push(
      <Link
        to={`/app/clientes/${encodeURIComponent(clientId)}/entrenamiento`}
        className="ws-card ws-card-link"
        key="training"
      >
        <p className="ws-stat-label flex items-center justify-between gap-2">
          <span>Entrenamiento</span>
          <Icon name="arrow-right" size={14} />
        </p>
        <p className="ws-stat-value client-hub-stat-text">
          {activity
            ? `${activity.sessionsLast7} de ${stats.trainingDays} en 7 d`
            : sections.trainingPlan.plan.name}
        </p>
        <p className="ws-stat-note">
          {activity?.lastSession
            ? `Último ${relativeDay(activity.lastSession)} · ${activity.setsLast30} series/30 d`
            : `${scheduleLabel(sections.trainingPlan.plan)} · ${count(stats.trainingDays, 'día', 'días')}`}
        </p>
      </Link>
    );
  }

  if (sections.nutritionPlan.status === 'available') {
    const plan = sections.nutritionPlan.plan;
    cards.push(
      <Link
        to={`/app/clientes/${encodeURIComponent(clientId)}/nutricion`}
        className="ws-card ws-card-link"
        key="nutrition"
      >
        <p className="ws-stat-label flex items-center justify-between gap-2">
          <span>Alimentación activa</span>
          <Icon name="arrow-right" size={14} />
        </p>
        <p className="ws-stat-value client-hub-stat-text">
          {plan.caloriesTarget !== null
            ? `${plan.caloriesTarget} kcal`
            : plan.name}
        </p>
        <p className="ws-stat-note">
          {plan.proteinTargetG !== null ? `P ${plan.proteinTargetG}g` : ''}
          {plan.carbsTargetG !== null ? ` · C ${plan.carbsTargetG}g` : ''}
          {plan.fatTargetG !== null ? ` · G ${plan.fatTargetG}g` : ''}
          {plan.proteinTargetG === null &&
            `${plan.meals.length} ${plan.meals.length === 1 ? 'comida' : 'comidas'}`}
        </p>
      </Link>
    );
  }

  if (
    sections.bodyWeightHistory.status === 'available' &&
    sections.bodyWeightHistory.entries.length > 0
  ) {
    const entries = sections.bodyWeightHistory.entries;
    const latest = entries[0];
    const older = entries.at(-1);
    const diff =
      entries.length > 1 && older
        ? Number((latest.weightKg - older.weightKg).toFixed(1))
        : null;
    cards.push(
      <Link
        to={`/app/clientes/${encodeURIComponent(clientId)}/seguimiento`}
        className="ws-card ws-card-link"
        key="weight"
      >
        <p className="ws-stat-label flex items-center justify-between gap-2">
          <span>Peso en check-ins</span>
          <Icon name="arrow-right" size={14} />
        </p>
        <p className="ws-stat-value client-hub-stat-text">
          {latest.weightKg} kg
        </p>
        <p className="ws-stat-note">
          {diff !== null
            ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} kg en últimos registros`
            : 'Último check-in · ver seguimiento'}
        </p>
      </Link>
    );
  }

  if (
    sections.evaluations.status === 'available' &&
    sections.evaluations.evaluations.length > 0
  ) {
    const latestEval = sections.evaluations.evaluations[0];
    const evalWeight =
      latestEval.weightKg ?? latestEval.assessment?.measurements.weightKg;
    const fat = latestBodyFat(sections.evaluations);
    cards.push(
      <Link
        to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion`}
        className="ws-card ws-card-link"
        key="evaluation"
      >
        <p className="ws-stat-label flex items-center justify-between gap-2">
          <span>Última evaluación</span>
          <Icon name="arrow-right" size={14} />
        </p>
        <p className="ws-stat-value client-hub-stat-text">
          {fat
            ? `${fat.value.toFixed(1)} % grasa`
            : evalWeight !== null && evalWeight !== undefined
              ? `${evalWeight} kg`
              : `${sections.evaluations.evaluations.length} registrada${sections.evaluations.evaluations.length === 1 ? '' : 's'}`}
        </p>
        <p className="ws-stat-note">
          {evalWeight !== null && evalWeight !== undefined && fat
            ? `${evalWeight} kg · `
            : ''}
          {sections.evaluations.evaluations.length}{' '}
          {sections.evaluations.evaluations.length === 1
            ? 'evaluación'
            : 'evaluaciones'}
        </p>
      </Link>
    );
  } else if (cards.length === 0 && record.goal) {
    return null;
  }

  if (cards.length === 0) return null;
  return <div className="ws-stats">{cards}</div>;
}

function RoutineCard({
  section,
  clientId,
}: {
  section: TrainingSection;
  clientId: string;
}) {
  const training = `/app/clientes/${clientId}/entrenamiento`;
  return (
    <Card
      title="Entrenamiento"
      icon="dumbbell"
      action={
        <Link to={training} className="ws-btn">
          Gestionar rutina y registros
        </Link>
      }
    >
      {section.status === 'available' ? (
        <div className="space-y-3">
          <p className="font-semibold">
            {section.plan.name}{' '}
            <span className="text-sm font-normal text-(--ws-muted)">
              · {scheduleLabel(section.plan)}
            </span>
          </p>
          <RoutineWeek routine={section.plan} compact />
        </div>
      ) : section.status === 'empty' ? (
        <div className="space-y-3">
          <p className="text-(--ws-muted)">
            Todavía no tiene una rutina activa.
          </p>
          <Link to={training} className="ws-btn" data-variant="primary">
            Asignar rutina
          </Link>
        </div>
      ) : (
        <SectionState section={section} />
      )}
    </Card>
  );
}
