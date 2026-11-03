import { useEffect, useState } from 'react';
import { Link } from '../../../components/Link';
import { fetchProfessionalRecord } from '../services/record';
import type { ClientBaseRecord } from '../types/portfolio';
import type { ProfessionalRecord } from '../types/record';
import ClientRecordEditor from './ClientRecordEditor';
import ClientStatusAction from './ClientStatusAction';
import ClientBaseDetails from './ClientBaseDetails';
import ClientRecordSections from './ClientRecordSections';

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
  const record = loading ? null : result.record;
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
      <Link
        to="/app/clientes"
        className="inline-block text-sm font-semibold text-(--ws-primary-fg) hover:underline"
      >
        ← Volver a mi cartera
      </Link>
      <h1 className="ws-title mt-0!">Expediente del cliente</h1>
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
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
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
            <div className="ws-card flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">{record.fullName}</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => {
                    setSaved(false);
                    setEditing(true);
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Editar datos base
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => setAttempt((n) => n + 1)}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Actualizar expediente
                </button>
                <ClientStatusAction
                  sessionReady={sessionReady}
                  clientId={clientId}
                  status={record.status}
                  accountId={accountId}
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
              </div>
            </div>
            <div className="ws-card space-y-4">
              <h3 className="ws-card-title">Perfil y medidas base</h3>
              <ClientBaseDetails record={record} />
            </div>
            {sections && <ClientRecordSections sections={sections} />}
          </>
        ))
      )}
    </section>
  );
}
