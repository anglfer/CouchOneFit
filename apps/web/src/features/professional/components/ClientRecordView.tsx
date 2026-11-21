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
                data-variant="primary"
                disabled={isEditing || loading || statusBusy || hasPending}
                onClick={() => {
                  setSaved(false);
                  setEditing(panel);
                }}
              >
                Editar datos base
              </button>
              <button
                type="button"
                className="ws-btn"
                disabled={isEditing || loading || statusBusy}
                onClick={refresh}
              >
                Actualizar expediente
              </button>
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
            </>
          }
        />
      ) : (
        <Link to="/app/clientes" className="client-hub-back">
          ← Clientes
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
            ✓ {notice}
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
                  <ActivityStats section={sections.trainingPlan} />
                  <div className="client-hub-grid">
                    <RoutineCard
                      section={sections.trainingPlan}
                      clientId={clientId}
                    />
                    <Card title="Perfil y medidas base" icon="user">
                      <div className="space-y-4">
                        <ClientBaseDetails record={record} />
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

/** Quick numbers from the routine and the client's own log. */
function ActivityStats({ section }: { section: TrainingSection }) {
  if (section.status !== 'available') return null;
  const stats = routineStats(section.plan);
  const activity = section.activity;
  return (
    <div className="ws-stats">
      <div className="ws-card">
        <p className="ws-stat-label">Rutina</p>
        <p className="ws-stat-value client-hub-stat-text">
          {section.plan.name}
        </p>
        <p className="ws-stat-note">
          {scheduleLabel(section.plan)} ·{' '}
          {count(
            stats.trainingDays,
            'día de entrenamiento',
            'días de entrenamiento'
          )}
        </p>
      </div>
      {activity && (
        <>
          <div className="ws-card">
            <p className="ws-stat-label">Último entrenamiento</p>
            <p className="ws-stat-value client-hub-stat-text">
              {activity.lastSession
                ? relativeDay(activity.lastSession)
                : 'Aún sin registros'}
            </p>
            <p className="ws-stat-note">
              {activity.lastSession
                ? 'Registrado por el cliente en su móvil'
                : 'Aparecerá cuando registre su primera sesión'}
            </p>
          </div>
          <div className="ws-card">
            <p className="ws-stat-label">Entrenamientos en 7 días</p>
            <p className="ws-stat-value">
              {activity.sessionsLast7}
              <span className="text-base font-medium text-(--ws-muted)">
                {' '}
                / {stats.trainingDays}
              </span>
            </p>
            <p className="ws-stat-note">
              {activity.sessionsLast30} en los últimos 30 días
            </p>
          </div>
          <div className="ws-card">
            <p className="ws-stat-label">Series hechas en 30 días</p>
            <p className="ws-stat-value">{activity.setsLast30}</p>
            <p className="ws-stat-note">Detalle por serie en Entrenamiento</p>
          </div>
        </>
      )}
    </div>
  );
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
