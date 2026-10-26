import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { sessionMutation, sessionRequest } from '../../auth/services/session';

interface ClientRecord {
  id: string;
  userId: string | null;
  fullName: string;
  goal: string | null;
  status: string;
  invitationExpiresAt: string | null;
}
export default function ClientAccessPanel() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [fullName, setFullName] = useState('');
  const [goal, setGoal] = useState('');
  const [delivery, setDelivery] = useState<{
    code: string;
    expiresAt: string;
    clientId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void sessionRequest<{ clients: ClientRecord[] }>('/api/clients')
      .then((result) => {
        if (active) {
          setClients(result.clients);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('No pudimos consultar los expedientes.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  async function invitation(record: ClientRecord, revoke = false) {
    if (busy) return;
    setBusy(record.id);
    setError('');
    setDelivery(null);
    setCopied(false);
    try {
      const result = await sessionMutation<{ code: string; expiresAt: string }>(
        `/api/clients/${record.id}/invitations`,
        {},
        revoke ? 'DELETE' : 'POST'
      );
      if (!revoke) setDelivery({ ...result, clientId: record.id });
      setClients((items) =>
        items.map((item) =>
          item.id === record.id
            ? { ...item, invitationExpiresAt: revoke ? null : result.expiresAt }
            : item
        )
      );
    } catch (failure) {
      if (failure instanceof ApiError) {
        if (failure.status === 401)
          window.location.replace('/acceso?motivo=sesion');
        else if (failure.status === 409 && failure.code === 'CUPO_AGOTADO') {
          setError(
            'No tienes cupo suficiente en tu plan actual. Desactiva un cliente existente o contacta a soporte para un upgrade.'
          );
        } else {
          setError(failure.message);
        }
      } else {
        setError('No pudimos completar la solicitud.');
      }
    } finally {
      setBusy('');
    }
  }
  async function copyCode() {
    if (!delivery) return;
    try {
      await navigator.clipboard.writeText(delivery.code);
      setCopied(true);
    } catch {
      setError(
        'No pudimos copiar. Selecciona el código y cópialo manualmente.'
      );
    }
  }
  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy('new');
    setError('');
    try {
      await sessionMutation('/api/clients', {
        fullName,
        goal: goal.trim() || null,
      });
      setFullName('');
      setGoal('');
      setAttempt((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos crear el expediente.'
      );
    } finally {
      setBusy('');
    }
  }
  async function toggleStatus(record: ClientRecord) {
    if (busy) return;
    setBusy(record.id);
    setError('');
    setDelivery(null);
    try {
      await sessionMutation(
        `/api/clients/${record.id}/status`,
        { status: record.status === 'active' ? 'inactive' : 'active' },
        'PATCH'
      );
      setAttempt((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos cambiar el estado.'
      );
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200 dark:border-slate-800 space-y-5">
      <h1 className="text-xl font-bold">Acceso a expedientes</h1>
      <p>
        Entrega una invitación privada al cliente de un expediente preparado.
        Reemplazarla invalida inmediatamente el código anterior. Se requiere
        expediente, profesional y suscripción activos.
      </p>
      <form onSubmit={saveRecord} className="border rounded-xl p-4 space-y-3">
        <h2 className="font-bold">Nuevo expediente</h2>
        <label className="block">
          Nombre completo
          <input
            required
            minLength={2}
            maxLength={150}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="block border p-2 rounded-lg w-full"
          />
        </label>
        <label className="block">
          Objetivo (opcional)
          <input
            maxLength={500}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="block border p-2 rounded-lg w-full"
          />
        </label>
        <button
          disabled={!!busy}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {busy === 'new' ? 'Guardando…' : 'Crear expediente'}
        </button>
      </form>
      {loading ? (
        <p role="status">Cargando expedientes…</p>
      ) : clients.length === 0 ? (
        <p>No hay expedientes preparados en tu cartera.</p>
      ) : (
        <ul className="space-y-4">
          {clients.map((record) => (
            <li key={record.id} className="border rounded-xl p-4 space-y-3">
              <h2 className="font-bold">{record.fullName}</h2>
              <p>{record.goal}</p>
              <p>
                {record.userId
                  ? 'Cuenta vinculada'
                  : record.status !== 'active'
                    ? 'Expediente inactivo'
                    : 'Sin cuenta vinculada'}
              </p>
              {record.invitationExpiresAt && (
                <p>
                  Invitación vigente hasta{' '}
                  {new Date(record.invitationExpiresAt).toLocaleString('es-MX')}
                </p>
              )}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void toggleStatus(record)}
                className="px-4 py-2 border rounded-lg"
              >
                {record.status === 'active'
                  ? 'Inactivar expediente'
                  : 'Reactivar expediente'}
              </button>
              {!record.userId && record.status === 'active' && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void invitation(record)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {busy === record.id
                    ? 'Procesando…'
                    : record.invitationExpiresAt
                      ? 'Reemplazar invitación'
                      : 'Generar invitación'}
                </button>
              )}
              {record.invitationExpiresAt && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void invitation(record, true)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Revocar invitación
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar consulta
          </button>
        </div>
      )}
      {delivery && (
        <div role="status" className="border rounded-xl p-4 space-y-3">
          <h2 className="font-bold">
            Invitación para{' '}
            {
              clients.find((record) => record.id === delivery.clientId)
                ?.fullName
            }
          </h2>
          <p>
            Entrega el código de forma privada. Vence el{' '}
            {new Date(delivery.expiresAt).toLocaleString('es-MX')}. Solo se
            muestra en esta entrega.
          </p>
          <label className="block">
            Código de invitación
            <input
              readOnly
              value={delivery.code}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full border p-3 rounded-lg font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => void copyCode()}
            className="px-4 py-2 border rounded-lg"
          >
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
          <button
            type="button"
            onClick={() => setDelivery(null)}
            className="px-4 py-2"
          >
            Ocultar código
          </button>
        </div>
      )}
    </section>
  );
}
