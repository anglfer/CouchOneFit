import EvolutionSection from '../components/EvolutionSection';
import AssessmentForm from '../components/AssessmentForm';
import { navigate } from '../../../utils/navigation';
import { useEffect, useState, useRef } from 'react';
import { Link } from '../../../components/Link';
import { sessionRequest } from '../../auth/services/session';
import type { ProfessionalRecord } from '../../professional/types/record';
import EvaluationsSection from '../components/EvaluationsSection';
import { isEvaluation, type Evaluation } from '../types/evaluation';
import { useOperations } from '../../../hooks/useOperations';
import { evolutionDate, evolutionValue } from '../utils/evolution';

type EvaluationTab = 'evolution' | 'history';

function initialTab(
  hasConfirmedEvaluations: boolean,
  hasPendingOperations: boolean
): EvaluationTab {
  if (typeof window !== 'undefined') {
    if (window.location.hash === '#evolucion-antropometrica')
      return 'evolution';
    if (window.location.hash === '#historial') return 'history';
  }
  if (hasConfirmedEvaluations && !hasPendingOperations) return 'evolution';
  return 'history';
}

function readWeight(e: Evaluation | undefined): number | null {
  if (!e) return null;
  return e.weightKg ?? e.assessment?.measurements.weightKg ?? null;
}

function readWaist(e: Evaluation | undefined): number | null {
  if (!e) return null;
  return e.waistCm ?? e.assessment?.measurements.waistCm ?? null;
}

function readFat(e: Evaluation | undefined): number | null {
  if (!e) return null;
  return (
    e.measuredBodyFatPercentage ??
    e.assessment?.results.bodyFatPercentage ??
    null
  );
}

function formatSignedDelta(
  current: number | null,
  previous: number | null,
  unit: string
): { label: string; sign: 'up' | 'down' | 'flat' } | null {
  if (current === null || previous === null) return null;
  const diff = Number((current - previous).toFixed(1));
  if (Math.abs(diff) < 0.05) return { label: `Sin cambio`, sign: 'flat' };
  const arrow = diff > 0 ? '+' : '−';
  return {
    label: `${arrow}${evolutionValue(Math.abs(diff))} ${unit}`,
    sign: diff > 0 ? 'up' : 'down',
  };
}

export default function EvaluationsPage({
  clientId,
  capture = false,
  accountId,
  record,
  recordRevision,
  refresh,
}: {
  clientId: string;
  accountId: string;
  capture?: boolean;
  record: ProfessionalRecord;
  recordRevision: number;
  refresh: () => void;
}) {
  const [notice, setNotice] = useState('');
  const pendingOperations = useOperations().filter(
    (o) => o.kind === 'evaluation.create' && o.clientId === clientId
  );
  const confirmedEvaluations =
    record.sections.evaluations.status === 'available'
      ? record.sections.evaluations.evaluations
      : [];
  const [tab, setTab] = useState<EvaluationTab>(() =>
    initialTab(confirmedEvaluations.length > 0, pendingOperations.length > 0)
  );

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === '#evolucion-antropometrica') {
        setTab('evolution');
      } else if (window.location.hash === '#historial') {
        setTab('history');
      }
    };
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  if (capture) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              Nueva evaluación antropométrica
            </h2>
            <p className="mt-1 text-sm text-(--ws-muted)">
              Elige la metodología y registra los datos de{' '}
              {record.profile.fullName}.
            </p>
          </div>
          <Link
            className="ws-btn"
            to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion`}
            preventScrollReset
          >
            Volver a Evaluación
          </Link>
        </div>
        {record.profile.status === 'inactive' ? (
          <p className="ws-alert" data-tone="warn">
            El expediente está inactivo. Puedes consultar su historial, pero no
            registrar evaluaciones nuevas.
          </p>
        ) : (
          <section className="ws-card">
            <AssessmentForm
              clientId={clientId}
              clientName={record.profile.fullName}
              birthDate={record.profile.birthDate}
              baseHeightCm={record.profile.heightCm}
              previousEvaluations={confirmedEvaluations}
              onSaved={() => {
                setNotice('La evaluación se guardó correctamente.');
                refresh();
              }}
              onQueued={() => setNotice('')}
            />
          </section>
        )}
      </div>
    );
  }

  const latest = confirmedEvaluations[0];
  const previous = confirmedEvaluations[1];
  const latestWeight = readWeight(latest);
  const weightDelta = formatSignedDelta(
    latestWeight,
    readWeight(previous),
    'kg'
  );
  const latestFat = readFat(latest);
  const fatDelta = formatSignedDelta(latestFat, readFat(previous), '%');
  const latestWaist = readWaist(latest);
  const waistDelta = formatSignedDelta(latestWaist, readWaist(previous), 'cm');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Evaluación antropométrica</h2>
          <p className="mt-1 text-sm text-(--ws-muted)">
            Mediciones y composición corporal registradas en consulta.
          </p>
        </div>
        {record.profile.status === 'active' && (
          <Link
            className="ws-btn min-h-11"
            data-variant="primary"
            to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion/nueva`}
          >
            Nueva evaluación
          </Link>
        )}
      </div>

      {notice && (
        <p role="status" className="ws-alert" data-tone="ok">
          {notice}
        </p>
      )}

      {latest && (
        <section
          aria-label="Resumen de la última evaluación"
          className="ws-kpi-strip"
        >
          <article className="ws-kpi-mini">
            <span className="ws-stat-label">Última evaluación</span>
            <strong className="ws-kpi-mini-value">
              {evolutionDate(
                latest.assessment?.effectiveDate ?? latest.evaluationDate
              )}
            </strong>
            <span className="text-xs text-(--ws-muted)">
              {confirmedEvaluations.length}{' '}
              {confirmedEvaluations.length === 1
                ? 'registro confirmado'
                : 'registros confirmados'}
            </span>
          </article>
          <article className="ws-kpi-mini">
            <span className="ws-stat-label">Peso</span>
            <strong className="ws-kpi-mini-value tabular-nums">
              {latestWeight !== null
                ? `${evolutionValue(latestWeight)} kg`
                : '—'}
            </strong>
            {weightDelta && (
              <span className="ws-delta" data-sign={weightDelta.sign}>
                {weightDelta.label} vs. anterior
              </span>
            )}
          </article>
          <article className="ws-kpi-mini">
            <span className="ws-stat-label">Grasa corporal</span>
            <strong className="ws-kpi-mini-value tabular-nums">
              {latestFat !== null ? `${evolutionValue(latestFat)} %` : '—'}
            </strong>
            {fatDelta && (
              <span className="ws-delta" data-sign={fatDelta.sign}>
                {fatDelta.label} vs. anterior
              </span>
            )}
          </article>
          <article className="ws-kpi-mini">
            <span className="ws-stat-label">Cintura</span>
            <strong className="ws-kpi-mini-value tabular-nums">
              {latestWaist !== null ? `${evolutionValue(latestWaist)} cm` : '—'}
            </strong>
            {waistDelta && (
              <span className="ws-delta" data-sign={waistDelta.sign}>
                {waistDelta.label} vs. anterior
              </span>
            )}
          </article>
        </section>
      )}

      <div
        className="client-subtabs"
        role="tablist"
        aria-label="Vistas de evaluación"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'evolution'}
          aria-controls="eval-panel-evolution"
          onClick={() => setTab('evolution')}
        >
          Evolución y gráfica
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          aria-controls="eval-panel-history"
          onClick={() => setTab('history')}
        >
          Historial de sesiones
          {confirmedEvaluations.length > 0 && (
            <span className="ws-chip">{confirmedEvaluations.length}</span>
          )}
          {pendingOperations.length > 0 && (
            <span className="ws-badge" data-tone="warn">
              {pendingOperations.length} pendiente
              {pendingOperations.length === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </div>

      <div id="eval-panel-evolution" hidden={tab !== 'evolution'}>
        <EvolutionSection
          accountId={accountId}
          clientId={clientId}
          initialStatus={record.sections.progress.status}
        />
      </div>

      <div id="eval-panel-history" hidden={tab !== 'history'}>
        <EvaluationHistory
          key={recordRevision}
          record={record}
          refresh={refresh}
        />
      </div>
    </div>
  );
}

function EvaluationHistory({
  record,
  refresh,
}: {
  record: ProfessionalRecord;
  refresh: () => void;
}) {
  const { profile, sections } = record;
  const clientId = profile.id;
  const section = sections.evaluations;
  const [error, setError] = useState(''),
    [older, setOlder] = useState<Evaluation[]>([]),
    [hasMore, setHasMore] = useState(
      section.status === 'available' && section.evaluations.length === 20
    ),
    [loadingMore, setLoadingMore] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function more() {
    if (section.status !== 'available' || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const offset = section.evaluations.length + older.length;
      const payload = await sessionRequest<{ evaluations: unknown[] }>(
        `/api/clients/${encodeURIComponent(clientId)}/evaluations?offset=${offset}`
      );
      if (
        !Array.isArray(payload.evaluations) ||
        !payload.evaluations.every((v) => isEvaluation(v, clientId))
      )
        throw Error('Invalid history');
      if (!mounted.current) return;
      const rows = payload.evaluations as Evaluation[];
      setOlder((previous) => [
        ...previous,
        ...rows.filter(
          (row) =>
            !previous.some((p) => p.id === row.id) &&
            !section.evaluations.some((p) => p.id === row.id)
        ),
      ]);
      setHasMore(rows.length === 20);
    } catch {
      if (mounted.current)
        setError('No pudimos cargar las evaluaciones anteriores.');
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }
  const combined =
    section.status === 'available'
      ? { ...section, evaluations: [...section.evaluations, ...older] }
      : section;
  return (
    <section className="ws-card space-y-4">
      {error && (
        <p role="alert">
          {error}
          <button className="ws-btn" type="button" onClick={() => void more()}>
            Reintentar
          </button>
        </p>
      )}
      <EvaluationsSection
        clientId={clientId}
        clientName={profile.fullName}
        clientStatus={profile.status}
        section={combined}
        onSaved={refresh}
        onRetry={refresh}
      />
      {hasMore && !error && (
        <button
          type="button"
          className="ws-btn"
          disabled={loadingMore}
          onClick={() => void more()}
        >
          {loadingMore ? 'Cargando…' : 'Cargar evaluaciones anteriores'}
        </button>
      )}
    </section>
  );
}

/** Compatibility only: old Web URLs never render an independent module. */
export function LegacyEvaluationRedirect({
  clientId,
  capture = false,
}: {
  clientId?: string;
  capture?: boolean;
}) {
  useEffect(() => {
    let id = '';
    try {
      id = decodeURIComponent(clientId ?? '');
    } catch {
      /* Invalid encoded segment. */
    }
    const valid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      );
    navigate(
      valid
        ? `/app/clientes/${encodeURIComponent(id.toLowerCase())}/evaluacion${capture ? '/nueva' : ''}`
        : '/app/clientes',
      { replace: true }
    );
  }, [clientId, capture]);
  return <p role="status">Abriendo el expediente del cliente…</p>;
}
