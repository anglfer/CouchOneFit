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
    <section className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border space-y-4">
      <Link
        to="/app/clientes"
        className="inline-block text-indigo-600! dark:text-indigo-400! font-semibold"
      >
        ← Volver a mi cartera
      </Link>
      <h1 className="text-xl font-bold">Expediente del cliente</h1>
      {[saved && 'Los cambios se guardaron correctamente.', statusSaved]
        .filter(Boolean)
        .map((notice) => (
          <p
            key={notice as string}
            role="status"
            // The editor collapses after saving; bring the confirmation into view.
            ref={(node) => node?.scrollIntoView?.({ block: 'center' })}
            className="font-semibold text-emerald-700 dark:text-emerald-400"
          >
            ✓ {notice}
          </p>
        ))}
      {loading ? (
        <p role="status">Cargando expediente…</p>
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
            <h2 className="text-lg font-bold">{record.fullName}</h2>
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
            <h3 className="font-bold">Perfil y medidas base</h3>
            <ClientBaseDetails record={record} />
            {sections && <ClientRecordSections sections={sections} />}
          </>
        ))
      )}
    </section>
  );
}
