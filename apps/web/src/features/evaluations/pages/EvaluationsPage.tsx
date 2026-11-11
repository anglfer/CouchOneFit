import ClientHeader from '../../professional/components/ClientHeader';
import AssessmentForm from '../components/AssessmentForm';
import { navigate } from '../../../utils/navigation';
import { useOnSynced } from '../../../hooks/useOperations';
import { useEffect, useState, useRef } from 'react';
import { Link } from '../../../components/Link';
import { sessionRequest } from '../../auth/services/session';
import { fetchProfessionalRecord } from '../../professional/services/record';
import type { ProfessionalRecord } from '../../professional/types/record';
import EvaluationsSection from '../components/EvaluationsSection';
import { isEvaluation, type Evaluation } from '../types/evaluation';
export default function EvaluationsPage({
  clientId: initialClientId,
  capture = false,
}: {
  clientId: string;
  capture?: boolean;
}) {
  const clientId = initialClientId;
  const [notice, setNotice] = useState('');
  const [record, setRecord] = useState<ProfessionalRecord | null>(null),
    [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0),
    [older, setOlder] = useState<Evaluation[]>([]),
    [hasMore, setHasMore] = useState(true),
    [loadingMore, setLoadingMore] = useState(false);
  const latestClient = useRef(clientId);
  useEffect(() => {
    latestClient.current = clientId;
  }, [clientId]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    if (!clientId) return;
    void fetchProfessionalRecord(clientId)
      .then((value) => {
        if (current) {
          setRecord(value);
          setOlder([]);
          setHasMore(
            value.sections.evaluations.status === 'available' &&
              value.sections.evaluations.evaluations.length === 20
          );
        }
      })
      .catch(() => {
        if (current)
          setError(
            'No pudimos consultar este expediente. Comprueba el acceso o reintenta.'
          );
      });
    return () => {
      current = false;
    };
  }, [clientId, attempt, capture]);
  function refresh() {
    setRecord(null);
    setError('');
    setAttempt((n) => n + 1);
  }
  useOnSynced(() => {
    if (!capture) refresh();
  });
  async function more() {
    if (
      !record ||
      record.sections.evaluations.status !== 'available' ||
      loadingMore
    )
      return;
    setLoadingMore(true);
    try {
      const offset =
        record.sections.evaluations.evaluations.length + older.length;
      const payload = await sessionRequest<{ evaluations: unknown[] }>(
        `/api/clients/${encodeURIComponent(clientId)}/evaluations?offset=${offset}`
      );
      if (
        !Array.isArray(payload.evaluations) ||
        !payload.evaluations.every((v) => isEvaluation(v, clientId))
      )
        throw Error('Invalid history');
      if (latestClient.current !== clientId || !mounted.current) return;
      const rows = payload.evaluations as Evaluation[];
      setOlder((previous) => [
        ...previous,
        ...rows.filter(
          (row) =>
            !previous.some((p) => p.id === row.id) &&
            !(
              record.sections.evaluations.status === 'available' &&
              record.sections.evaluations.evaluations.some(
                (p) => p.id === row.id
              )
            )
        ),
      ]);
      setHasMore(rows.length === 20);
    } catch {
      if (latestClient.current === clientId && mounted.current)
        setError('No pudimos cargar las evaluaciones anteriores.');
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }
  const section = record?.sections.evaluations;
  const combined =
    section?.status === 'available'
      ? { ...section, evaluations: [...section.evaluations, ...older] }
      : section;
  if (capture)
    return (
      <div className="space-y-6">
        {record && (
          <ClientHeader
            clientId={clientId}
            name={record.profile.fullName}
            active="evaluation"
          />
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Nueva evaluación antropométrica
          </h2>
          <Link
            className="ws-btn"
            to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion`}
          >
            Volver a Evaluación
          </Link>
        </div>
        {error && (
          <p role="alert">
            {error}
            <button className="ws-btn" onClick={refresh}>
              Reintentar lectura
            </button>
          </p>
        )}
        {!record && !error && (
          <p role="status">Cargando expediente autorizado…</p>
        )}
        {record &&
          (record.profile.status === 'inactive' ? (
            <p className="ws-alert" data-tone="warn">
              El expediente está inactivo. Puedes consultar su historial, pero
              no registrar evaluaciones nuevas.
            </p>
          ) : (
            <section className="ws-card">
              <AssessmentForm
                key={clientId}
                clientId={clientId}
                clientName={record.profile.fullName}
                onSaved={() =>
                  setNotice('La evaluación se guardó correctamente.')
                }
                onQueued={() => setNotice('')}
              />
            </section>
          ))}
      </div>
    );
  return (
    <div className="space-y-5">
      {record && (
        <ClientHeader
          clientId={clientId}
          name={record.profile.fullName}
          active="evaluation"
        />
      )}
      <div>
        <h2 className="text-xl font-semibold">Evaluación antropométrica</h2>
        <p className="mt-1 text-sm text-(--ws-muted)">
          Mediciones y composición corporal. Consulta el historial confirmado y
          las operaciones locales de este cliente.
        </p>
      </div>
      {notice && (
        <p role="status" className="ws-alert">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert">
          {error}
          <button className="ws-btn" onClick={refresh}>
            Reintentar
          </button>
        </p>
      )}
      {clientId && !record && !error && (
        <p role="status">Cargando evaluaciones…</p>
      )}
      {record && combined && (
        <section className="ws-card space-y-4">
          <EvaluationsSection
            clientId={clientId}
            clientName={record.profile.fullName}
            clientStatus={record.profile.status}
            section={combined}
            onSaved={refresh}
            onRetry={refresh}
          />
          {hasMore && section?.status === 'available' && (
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
      )}
    </div>
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
