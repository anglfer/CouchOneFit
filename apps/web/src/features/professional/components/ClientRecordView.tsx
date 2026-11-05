import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../../components/Link';
import { Badge, Card } from '../../../components/ui';
import { useOnSynced, useOperations } from '../../../hooks/useOperations';
import type { Operation } from '../../../services/offline/outbox';
import RoutineWeek from '../../training/components/RoutineWeek';
import {
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
import ClientHeader from './ClientHeader';
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
  onStatusChanged,
  sessionReady,
}: Props) {
  const [result, setResult] = useState<{
    key: string;
    record: ClientBaseRecord | null;
    sections: ProfessionalRecord['sections'] | null;
    error: string;
  }>({ key: '', record: null, sections: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusSaved, setStatusSaved] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const requestKey = `${accountId}:${clientId}:${attempt}`;
  const loading = result.key !== requestKey;
  const stored = loading ? null : result.record;
  const pendingHere = useOperations().filter(
    (operation) => operation.clientId === clientId
  );
  const hasPending = pendingHere.length > 0;
  const record =
    stored && hasPending ? applyPending(stored, pendingHere) : stored;
  useOnSynced(useCallback(() => setAttempt((value) => value + 1), []));
  const error = loading ? '' : result.error;
  const sections = loading ? null : result.sections;
  useEffect(() => {
    let active = true;
    void fetchProfessionalRecord(clientId)
      .then(({ profile, sections }) => {
        if (active)
          setResult({ key: requestKey, record: profile, sections, error: '' });
      })
      .catch(() => {
        if (active)
          setResult({
            key: requestKey,
            record: null,
            sections: null,
            error:
              'No pudimos consultar el expediente. Puede no estar disponible o haber un problema de conexión.',
          });
      });
    return () => {
      active = false;
    };
  }, [clientId, attempt, requestKey]);
  return (
    <section className="space-y-5">
      {record ? (
        <ClientHeader
          clientId={clientId}
          name={record.fullName}
          active="summary"
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
            !editing && (
              <>
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  disabled={statusBusy || hasPending}
                  onClick={() => {
                    setSaved(false);
                    setEditing(true);
                  }}
                >
                  Editar datos base
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  disabled={statusBusy}
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Actualizar expediente
                </button>
                <ClientStatusAction
                  sessionReady={sessionReady}
                  clientId={clientId}
                  status={record.status}
                  accountId={accountId}
                  disabled={hasPending}
                  onQueued={() =>
                    setStatusSaved(
                      'Los cambios se guardaron en este dispositivo y se enviarán cuando haya conexión.'
                    )
                  }
                  onBusyChange={setStatusBusy}
                  onChanged={(updated) => {
                    setResult((current) => ({
                      ...current,
                      key: requestKey,
                      record: updated,
                      error: '',
                    }));
                    setStatusSaved(
                      updated.status === 'active'
                        ? 'El expediente está activo.'
                        : 'El expediente está inactivo.'
                    );
                    onStatusChanged();
                  }}
                />
              </>
            )
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
            // The editor collapses after saving; bring the confirmation into view.
            ref={(node) => node?.scrollIntoView?.({ block: 'center' })}
            className="ws-alert"
            data-tone="ok"
          >
            ✓ {notice}
          </p>
        ))}
      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Cargando expediente…</span>
          <div className="ws-skeleton h-24" />
          <div className="ws-skeleton h-40" />
        </div>
      ) : error ? (
        <div role="alert" className="ws-alert" data-tone="bad">
          <p>{error}</p>
          <button
            type="button"
            className="ws-btn"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Reintentar lectura
          </button>
        </div>
      ) : (
        record &&
        (editing ? (
          <ClientRecordEditor
            accountId={accountId}
            initial={record}
            onCancel={() => setEditing(false)}
            onQueued={() => {
              setEditing(false);
              setSaved(false);
              setStatusSaved(
                'Los cambios se guardaron en este dispositivo y se enviarán cuando haya conexión.'
              );
            }}
            onSaved={(updated) => {
              setResult((current) => ({
                ...current,
                key: requestKey,
                record: updated,
                error: '',
              }));
              setEditing(false);
              setSaved(true);
            }}
          />
        ) : (
          <>
            {hasPending && (
              <p className="ws-alert" data-tone="warn" role="status">
                Este expediente tiene cambios pendientes de enviar. Se muestran
                aquí tal como los capturaste.{' '}
                <Link to="/app/pendientes" className="font-semibold underline">
                  Ver pendientes
                </Link>
              </p>
            )}
            {sections && <ActivityStats section={sections.trainingPlan} />}
            <div className="client-hub-grid">
              {sections && (
                <RoutineCard
                  section={sections.trainingPlan}
                  clientId={clientId}
                />
              )}
              <Card title="Perfil y medidas base" icon="user">
                <div className="space-y-4">
                  <ClientBaseDetails record={record} />
                </div>
              </Card>
            </div>
            {sections && <ClientRecordSections sections={sections} />}
          </>
        ))
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
          {scheduleLabel(section.plan)} · {stats.trainingDays} días de
          entrenamiento
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
