import EvolutionSection from '../components/EvolutionSection';
import AssessmentForm from '../components/AssessmentForm';
import { navigate } from '../../../utils/navigation';
import { useEffect, useState, useRef } from 'react';
import { Link } from '../../../components/Link';
import { sessionRequest } from '../../auth/services/session';
import type { ProfessionalRecord } from '../../professional/types/record';
import EvaluationsSection from '../components/EvaluationsSection';
import { isEvaluation, type Evaluation } from '../types/evaluation';
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
  if (capture) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Nueva evaluación antropométrica
          </h2>
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
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Evaluación antropométrica</h2>
          <p className="mt-1 text-sm text-(--ws-muted)">
            Mediciones y composición corporal que registras en consulta.
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
        <p role="status" className="ws-alert">
          {notice}
        </p>
      )}
      <EvaluationHistory
        key={recordRevision}
        record={record}
        refresh={refresh}
      />
      <EvolutionSection
        accountId={accountId}
        clientId={clientId}
        initialStatus={record.sections.progress.status}
      />
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
