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

type ClientField =
  | 'fullName'
  | 'goal'
  | 'birthDate'
  | 'heightCm'
  | 'weightKg'
  | 'bodyFatPercentage'
  | 'waistCm'
  | 'hipCm';

type ClientForm = Record<ClientField, string>;

const emptyClientForm = (): ClientForm => ({
  fullName: '',
  goal: '',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  bodyFatPercentage: '',
  waistCm: '',
  hipCm: '',
});

const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value);

export default function ClientAccessPanel() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<ClientForm>(emptyClientForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<ClientForm>>({});
  const [saved, setSaved] = useState('');
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
    setFieldErrors({});
    setSaved('');
    try {
      await sessionMutation('/api/clients', {
        fullName: form.fullName,
        goal: form.goal.trim() || null,
        birthDate: form.birthDate,
        heightCm: numberOrNull(form.heightCm),
        weightKg: numberOrNull(form.weightKg),
        bodyFatPercentage: numberOrNull(form.bodyFatPercentage),
        waistCm: numberOrNull(form.waistCm),
        hipCm: numberOrNull(form.hipCm),
      });
      setForm(emptyClientForm());
      setSaved('El expediente se guardó correctamente.');
      setAttempt((value) => value + 1);
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.fields);
        setError(
          Object.keys(failure.fields).length
            ? ''
            : failure.message
        );
      } else setError('No pudimos crear el expediente.');
    } finally {
      setBusy('');
    }
  }

  function updateField(field: ClientField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
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
            value={form.fullName}
            onChange={(event) => updateField('fullName', event.target.value)}
            aria-invalid={!!fieldErrors.fullName}
            aria-describedby={fieldErrors.fullName ? 'client-full-name-error' : undefined}
            className="block border p-2 rounded-lg w-full"
          />
          {fieldErrors.fullName && (
            <p id="client-full-name-error" className="text-red-700" role="alert">
              {fieldErrors.fullName}
            </p>
          )}
        </label>
        <label className="block">
          Fecha de nacimiento
          <input
            required
            type="date"
            value={form.birthDate}
            onChange={(event) => updateField('birthDate', event.target.value)}
            aria-invalid={!!fieldErrors.birthDate}
            aria-describedby={fieldErrors.birthDate ? 'client-birth-date-error' : undefined}
            className="block border p-2 rounded-lg w-full"
          />
          <span className="text-sm">Solo se registran personas de 18 años o más.</span>
          {fieldErrors.birthDate && (
            <p id="client-birth-date-error" className="text-red-700" role="alert">
              {fieldErrors.birthDate}
            </p>
          )}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Estatura (cm)
            <input
              required
              type="number"
              min="100"
              max="250"
              step="0.1"
              inputMode="decimal"
              value={form.heightCm}
              onChange={(event) => updateField('heightCm', event.target.value)}
              aria-invalid={!!fieldErrors.heightCm}
              aria-describedby={fieldErrors.heightCm ? 'client-height-error' : undefined}
              className="block border p-2 rounded-lg w-full"
            />
            {fieldErrors.heightCm && (
              <p id="client-height-error" className="text-red-700" role="alert">
                {fieldErrors.heightCm}
              </p>
            )}
          </label>
          <label className="block">
            Peso base (kg)
            <input
              required
              type="number"
              min="30"
              max="300"
              step="0.1"
              inputMode="decimal"
              value={form.weightKg}
              onChange={(event) => updateField('weightKg', event.target.value)}
              aria-invalid={!!fieldErrors.weightKg}
              aria-describedby={fieldErrors.weightKg ? 'client-weight-error' : undefined}
              className="block border p-2 rounded-lg w-full"
            />
            {fieldErrors.weightKg && (
              <p id="client-weight-error" className="text-red-700" role="alert">
                {fieldErrors.weightKg}
              </p>
            )}
          </label>
        </div>
        <fieldset className="border rounded-lg p-3 space-y-3">
          <legend className="px-1">Medidas base opcionales</legend>
          <p className="text-sm">Déjalas vacías si no se midieron todavía.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              Grasa medida (%)
              <input
                type="number"
                min="2"
                max="60"
                step="0.1"
                inputMode="decimal"
                value={form.bodyFatPercentage}
                onChange={(event) => updateField('bodyFatPercentage', event.target.value)}
                aria-invalid={!!fieldErrors.bodyFatPercentage}
                aria-describedby={fieldErrors.bodyFatPercentage ? 'client-body-fat-error' : undefined}
                className="block border p-2 rounded-lg w-full"
              />
              {fieldErrors.bodyFatPercentage && (
                <p id="client-body-fat-error" className="text-red-700" role="alert">
                  {fieldErrors.bodyFatPercentage}
                </p>
              )}
            </label>
            <label className="block">
              Cintura (cm)
              <input
                type="number"
                min="40"
                max="250"
                step="0.1"
                inputMode="decimal"
                value={form.waistCm}
                onChange={(event) => updateField('waistCm', event.target.value)}
                aria-invalid={!!fieldErrors.waistCm}
                aria-describedby={fieldErrors.waistCm ? 'client-waist-error' : undefined}
                className="block border p-2 rounded-lg w-full"
              />
              {fieldErrors.waistCm && (
                <p id="client-waist-error" className="text-red-700" role="alert">
                  {fieldErrors.waistCm}
                </p>
              )}
            </label>
            <label className="block">
              Cadera (cm)
              <input
                type="number"
                min="50"
                max="250"
                step="0.1"
                inputMode="decimal"
                value={form.hipCm}
                onChange={(event) => updateField('hipCm', event.target.value)}
                aria-invalid={!!fieldErrors.hipCm}
                aria-describedby={fieldErrors.hipCm ? 'client-hip-error' : undefined}
                className="block border p-2 rounded-lg w-full"
              />
              {fieldErrors.hipCm && (
                <p id="client-hip-error" className="text-red-700" role="alert">
                  {fieldErrors.hipCm}
                </p>
              )}
            </label>
          </div>
        </fieldset>
        <label className="block">
          Objetivo (opcional)
          <input
            maxLength={500}
            value={form.goal}
            onChange={(event) => updateField('goal', event.target.value)}
            aria-invalid={!!fieldErrors.goal}
            aria-describedby={fieldErrors.goal ? 'client-goal-error' : undefined}
            className="block border p-2 rounded-lg w-full"
          />
          {fieldErrors.goal && (
            <p id="client-goal-error" className="text-red-700" role="alert">
              {fieldErrors.goal}
            </p>
          )}
        </label>
        <button
          disabled={!!busy}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {busy === 'new' ? 'Guardando…' : 'Crear expediente'}
        </button>
        {saved && <p role="status">{saved}</p>}
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
