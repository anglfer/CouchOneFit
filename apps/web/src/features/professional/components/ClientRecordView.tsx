import { useEffect, useState } from 'react';
import { Link } from '../../../components/Link';
import { sessionRequest } from '../../auth/services/session';
import type { ClientBaseRecord } from '../types/portfolio';
import ClientRecordEditor from './ClientRecordEditor';
import ClientStatusAction from './ClientStatusAction';

export default function ClientRecordView({
  clientId,
  accountId,
  onStatusChanged,
  sessionReady,
}: {
  clientId: string;
  accountId: string;
  onStatusChanged: () => void;
  sessionReady: boolean;
}) {
  const [result, setResult] = useState<{
    key: string;
    record: ClientBaseRecord | null;
    error: string;
  }>({ key: '', record: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusSaved, setStatusSaved] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const requestKey = `${clientId}:${attempt}`;
  const loading = result.key !== requestKey;
  const record = loading ? null : result.record;
  const error = loading ? '' : result.error;
  useEffect(() => {
    let active = true;
    void sessionRequest<{ client: ClientBaseRecord }>(
      `/api/clients/${encodeURIComponent(clientId)}`
    )
      .then(({ client }) => {
        if (active) setResult({ key: requestKey, record: client, error: '' });
      })
      .catch(() => {
        if (active)
          setResult({
            key: requestKey,
            record: null,
            error:
              'No pudimos consultar el expediente. Puede no estar disponible o haber un problema de conexión.',
          });
      });
    return () => {
      active = false;
    };
  }, [clientId, attempt, requestKey]);
  const value = (number: number | null, unit: string) =>
    number === null ? 'Sin registrar' : `${number} ${unit}`;
  return (
    <section className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border space-y-4">
      <Link to="/app/clientes">Volver a mi cartera</Link>
      <h1 className="text-xl font-bold">Datos base del cliente</h1>
      {saved && <p role="status">Los cambios se guardaron correctamente.</p>}
      {statusSaved && <p role="status">{statusSaved}</p>}
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
              setResult({ key: requestKey, record: updated, error: '' });
              setEditing(false);
              setSaved(true);
            }}
          />
        ) : (
          <>
            <h2 className="font-bold">{record.fullName}</h2>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              Editar datos base
            </button>
            <ClientStatusAction
              sessionReady={sessionReady}
              clientId={clientId}
              status={record.status}
              accountId={accountId}
              onBusyChange={setStatusBusy}
              onChanged={(updated) => {
                setResult({ key: requestKey, record: updated, error: '' });
                setStatusSaved(
                  updated.status === 'active'
                    ? 'El expediente está activo.'
                    : 'El expediente está inactivo.'
                );
                onStatusChanged();
              }}
            />
            <dl className="space-y-2">
              <dt>Estado</dt>
              <dd>{record.status === 'active' ? 'Activo' : 'Inactivo'}</dd>
              <dt>Fecha de nacimiento</dt>
              <dd>{record.birthDate ?? 'Sin registrar'}</dd>
              <dt>Estatura</dt>
              <dd>{value(record.heightCm, 'cm')}</dd>
              <dt>Peso base</dt>
              <dd>{value(record.baseWeightKg, 'kg')}</dd>
              <dt>Grasa base</dt>
              <dd>{value(record.baseBodyFatPercentage, '%')}</dd>
              <dt>Cintura</dt>
              <dd>{value(record.waistCm, 'cm')}</dd>
              <dt>Cadera</dt>
              <dd>{value(record.hipCm, 'cm')}</dd>
              <dt>Objetivo</dt>
              <dd>{record.goal ?? 'Sin registrar'}</dd>
            </dl>
          </>
        ))
      )}
    </section>
  );
}
