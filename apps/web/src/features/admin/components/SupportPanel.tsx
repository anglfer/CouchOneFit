import { useEffect, useState } from 'react';
import { sessionMutation, sessionRequest } from '../../auth/services/session';
import { ApiError } from '../../../services/api';
import { Badge } from '../../../components/ui';
import RequiresConnection from '../../../components/RequiresConnection';
import { usePwa } from '../../../hooks/usePwa';

/** API statuses are English codes; show them in Spanish with gender. */
const statusLabel = (status: string, ending: 'o' | 'a') =>
  status === 'active'
    ? `activ${ending}`
    : status === 'inactive'
      ? `inactiv${ending}`
      : status;

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
  const { isOnline } = usePwa();
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
    <section className="ws-card space-y-4" aria-labelledby="support-heading">
      <h2 id="support-heading" className="ws-card-title text-lg!">
        Soporte a clientes
      </h2>
      <p className="text-sm text-(--ws-muted)">
        Solo lectura. Cada consulta o restablecimiento queda registrado con tu
        usuario, la fecha y el motivo.
      </p>
      <RequiresConnection what="cada consulta de soporte queda auditada" />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
          setReloads((n) => n + 1);
        }}
      >
        <input
          className="ws-input min-w-52 flex-1"
          aria-label="Buscar cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nombre o usuario"
        />
        <button
          className="ws-btn"
          data-variant="primary"
          type="submit"
          disabled={!isOnline}
        >
          Buscar
        </button>
      </form>
      <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0">
        {clients.map((item) => (
          <li
            key={item.clientId}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <div className="min-w-0">
              <button
                type="button"
                className="font-semibold text-(--ws-primary-fg) underline"
                onClick={() => {
                  setSelected(item);
                  setRecord(null);
                  setCode('');
                  setReason('');
                }}
              >
                {item.fullName}
              </button>
              <p className="mt-0.5 text-xs text-(--ws-muted)">
                Profesional: {item.professionalName}
                {item.username ? ` · @${item.username}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={item.recordStatus === 'active' ? 'ok' : 'neutral'}>
                Expediente {statusLabel(item.recordStatus, 'o')}
              </Badge>
              <Badge
                tone={
                  item.accountStatus === 'active'
                    ? 'info'
                    : item.accountStatus
                      ? 'bad'
                      : 'neutral'
                }
              >
                {item.accountStatus
                  ? `Cuenta ${statusLabel(item.accountStatus, 'a')}`
                  : 'Sin cuenta vinculada'}
              </Badge>
            </div>
          </li>
        ))}
        {!clients.length && (
          <li className="py-6 text-center text-sm text-(--ws-muted)">
            Sin resultados.
          </li>
        )}
      </ul>
      {selected && (
        <div className="space-y-4 rounded-xl border border-(--ws-border) bg-(--ws-surface-2) p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{selected.fullName}</h3>
            <button
              type="button"
              className="ws-btn"
              onClick={() => {
                setSelected(null);
                setRecord(null);
                setCode('');
              }}
            >
              Cerrar detalle
            </button>
          </div>
          <label className="block">
            Motivo (obligatorio)
            <input
              className="ws-input mt-1 w-full min-h-11"
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            disabled={busy || reason.trim().length < 3 || !isOnline}
            onClick={() => void view()}
          >
            Ver expediente (solo lectura)
          </button>
          {selected.userId && selected.accountStatus === 'active' && (
            <div className="space-y-3 border-t border-(--ws-border) pt-3">
              <label className="block">
                Tu contraseña para autorizar
                <input
                  type="password"
                  autoComplete="current-password"
                  className="ws-input mt-1 w-full min-h-11"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="ws-btn"
                disabled={
                  busy || reason.trim().length < 3 || !password || !isOnline
                }
                onClick={() => void reset()}
              >
                Generar código de restablecimiento
              </button>
              <p className="text-sm text-(--ws-muted)">
                Confirma la identidad de la persona por la relación conocida
                antes de entregar el código.
              </p>
            </div>
          )}
          {code && (
            <p role="status" className="ws-alert" data-tone="ok">
              Código de restablecimiento (válido 30 minutos):{' '}
              <strong>{code}</strong>
            </p>
          )}
          {record && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-(--ws-border) bg-(--ws-surface) p-3 text-sm [&_dd]:m-0 [&_dd]:font-medium [&_dt]:text-(--ws-muted)">
              <dt>Profesional</dt>
              <dd>{record.professionalName}</dd>
              <dt>Suscripción</dt>
              <dd>
                {(
                  {
                    active: 'Activa',
                    grace: 'En periodo de gracia',
                    expired: 'Vencida',
                    suspended: 'Suspendida',
                    none: 'Sin suscripción',
                  } as Record<string, string>
                )[record.subscriptionStatus] ?? record.subscriptionStatus}
              </dd>
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
      {error && isOnline && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}
      <div>
        <h3 className="ws-card-title mb-2">Registro de soporte</h3>
        <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
          {log.map((entry) => (
            <li key={entry.id} className="py-2.5">
              {new Date(entry.createdAt).toLocaleString('es-MX')} ·{' '}
              {entry.adminUsername} ·{' '}
              {entry.action === 'view_record' ? 'consultó' : 'restableció'} a{' '}
              {entry.clientName} · «{entry.reason}»
            </li>
          ))}
          {!log.length && (
            <li className="py-6 text-center text-(--ws-muted)">
              Aún no hay consultas.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
