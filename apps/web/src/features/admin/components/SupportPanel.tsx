import { useEffect, useState } from 'react';
import { sessionMutation, sessionRequest } from '../../auth/services/session';
import { ApiError } from '../../../services/api';

// DEC-017: read-only support. Every consultation or reset states a reason and is logged.
interface SupportClient {
  clientId: string;
  userId: string | null;
  fullName: string;
  username: string | null;
  accountStatus: string | null;
  recordStatus: string;
  professionalName: string;
}
interface SupportRecord {
  fullName: string;
  goal: string | null;
  birthDate: string | null;
  heightCm: number | null;
  baseWeightKg: number | null;
  recordStatus: string;
  accountStatus: string | null;
  username: string | null;
  email: string | null;
  professionalName: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
}
interface LogEntry {
  id: string;
  action: 'view_record' | 'reset_issued';
  reason: string;
  createdAt: string;
  adminUsername: string;
  clientName: string;
}
const message = (error: unknown) =>
  error instanceof ApiError ? error.message : 'No pudimos completar la acción.';

export default function SupportPanel() {
  const [search, setSearch] = useState(''),
    [clients, setClients] = useState<SupportClient[]>([]),
    [log, setLog] = useState<LogEntry[]>([]),
    [selected, setSelected] = useState<SupportClient | null>(null),
    [reason, setReason] = useState(''),
    [password, setPassword] = useState(''),
    [record, setRecord] = useState<SupportRecord | null>(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  const [applied, setApplied] = useState(''),
    [reloads, setReloads] = useState(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ search: applied, pageSize: '20' });
    void Promise.all([
      sessionRequest<{ clients: SupportClient[] }>(
        `/api/admin/support/clients?${params}`
      ),
      sessionRequest<{ entries: LogEntry[] }>(
        '/api/admin/support/log?pageSize=10'
      ),
    ])
      .then(([list, entries]) => {
        if (!active) return;
        setClients(list.clients);
        setLog(entries.entries);
      })
      .catch((failure) => {
        if (active) setError(message(failure));
      });
    return () => {
      active = false;
    };
  }, [applied, reloads]);

  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await run();
      setReloads((n) => n + 1);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  const view = () =>
    act(async () => {
      const result = await sessionMutation<{ record: SupportRecord }>(
        `/api/admin/support/clients/${selected!.clientId}/view`,
        { reason }
      );
      setRecord(result.record);
      setCode('');
    });
  const reset = () =>
    act(async () => {
      const result = await sessionMutation<{ code: string }>(
        `/api/accounts/${selected!.userId}/recovery`,
        {
          identityVerified: true,
          verificationMethod: 'known_relationship',
          currentPassword: password,
          reason,
        }
      );
      setCode(result.code);
      setPassword('');
    });

  return (
    <section className="space-y-4" aria-labelledby="support-heading">
      <h2 id="support-heading" className="text-xl font-bold">
        Soporte a clientes
      </h2>
      <p className="text-sm text-slate-500">
        Solo lectura. Cada consulta o restablecimiento queda registrado con tu
        usuario, la fecha y el motivo.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
          setReloads((n) => n + 1);
        }}
      >
        <input
          className="border rounded p-2 flex-1"
          aria-label="Buscar cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nombre o usuario"
        />
        <button className="underline">Buscar</button>
      </form>
      <ul className="space-y-1">
        {clients.map((item) => (
          <li key={item.clientId}>
            <button
              className="underline text-left"
              onClick={() => {
                setSelected(item);
                setRecord(null);
                setCode('');
                setReason('');
              }}
            >
              {item.fullName}
            </button>{' '}
            · {item.professionalName} · expediente {item.recordStatus} · cuenta{' '}
            {item.accountStatus ?? 'sin activar'}
          </li>
        ))}
        {!clients.length && <li>Sin resultados.</li>}
      </ul>
      {selected && (
        <div className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-bold">{selected.fullName}</h3>
          <label className="block">
            Motivo (obligatorio)
            <input
              className="border rounded p-2 w-full"
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className="underline"
            disabled={busy || reason.trim().length < 3}
            onClick={() => void view()}
          >
            Ver expediente (solo lectura)
          </button>
          {selected.userId && selected.accountStatus === 'active' && (
            <div className="space-y-2">
              <label className="block">
                Tu contraseña para autorizar
                <input
                  type="password"
                  autoComplete="current-password"
                  className="border rounded p-2 w-full"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button
                className="underline"
                disabled={busy || reason.trim().length < 3 || !password}
                onClick={() => void reset()}
              >
                Generar código de restablecimiento
              </button>
              <p className="text-sm text-slate-500">
                Confirma la identidad de la persona por la relación conocida
                antes de entregar el código.
              </p>
            </div>
          )}
          {code && (
            <p role="status">
              Código de restablecimiento (válido 30 minutos):{' '}
              <strong>{code}</strong>
            </p>
          )}
          {record && (
            <dl className="grid grid-cols-2 gap-2">
              <dt>Profesional</dt>
              <dd>{record.professionalName}</dd>
              <dt>Suscripción</dt>
              <dd>{record.subscriptionStatus}</dd>
              <dt>Usuario / correo</dt>
              <dd>
                {record.username ?? '—'} · {record.email ?? '—'}
              </dd>
              <dt>Objetivo</dt>
              <dd>{record.goal ?? '—'}</dd>
              <dt>Nacimiento</dt>
              <dd>{record.birthDate ?? '—'}</dd>
              <dt>Estatura / peso base</dt>
              <dd>
                {record.heightCm ?? '—'} cm · {record.baseWeightKg ?? '—'} kg
              </dd>
            </dl>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div>
        <h3 className="font-bold">Registro de soporte</h3>
        <ul>
          {log.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.createdAt).toLocaleString('es-MX')} ·{' '}
              {entry.adminUsername} ·{' '}
              {entry.action === 'view_record' ? 'consultó' : 'restableció'} a{' '}
              {entry.clientName} · «{entry.reason}»
            </li>
          ))}
          {!log.length && <li>Aún no hay consultas.</li>}
        </ul>
      </div>
    </section>
  );
}
