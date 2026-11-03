import { useEffect, useState } from 'react';
import { ApiError } from '../../../services/api';
import { sessionMutation, sessionRequest } from '../../auth/services/session';

import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge } from '../../../components/ui';
import ClientAccountAction from './ClientAccountAction';
import ClientStatusAction from './ClientStatusAction';
import GoalField from './GoalField';
import type { ClientRecord, PortfolioResponse } from '../types/portfolio';

type ClientField =
  | 'fullName'
  | 'goal'
  | 'birthDate'
  | 'heightCm'
  | 'baseWeightKg'
  | 'baseBodyFatPercentage'
  | 'waistCm'
  | 'hipCm';

type ClientForm = Record<ClientField, string>;

const emptyClientForm = (): ClientForm => ({
  fullName: '',
  goal: '',
  birthDate: '',
  heightCm: '',
  baseWeightKg: '',
  baseBodyFatPercentage: '',
  waistCm: '',
  hipCm: '',
});

const numberOrNull = (value: string) =>
  value.trim() === '' ? null : Number(value);

export default function ClientAccessPanel({
  accountId,
  onStatusChanged,
  sessionReady,
}: {
  accountId: string;
  onStatusChanged: () => void;
  sessionReady: boolean;
}) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<ClientForm>(emptyClientForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<ClientForm>>({});
  const [saved, setSaved] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [delivery, setDelivery] = useState<{
    code: string;
    expiresAt: string;
    clientId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    pageSize: 20,
  });
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [pageInfo, setPageInfo] = useState<
    PortfolioResponse['pageInfo'] | null
  >(null);
  const [hasClients, setHasClients] = useState(false);
  const [listError, setListError] = useState('');
  const [formToggled, setFormToggled] = useState<boolean | null>(null);
  const requestKey = JSON.stringify([attempt, filters, cursors]);
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      search: filters.search,
      status: filters.status,
      pageSize: String(filters.pageSize),
    });
    const cursor = cursors.at(-1);
    if (cursor) params.set('cursor', cursor);
    void sessionRequest<PortfolioResponse>(`/api/clients?${params}`)
      .then((result) => {
        if (active) {
          setClients(result.clients);
          setHasClients(result.hasClients);
          setPageInfo(result.pageInfo);
          setListError('');
          setDelivery(null);
        }
      })
      .catch(() => {
        if (active) {
          setListError('No pudimos consultar los expedientes.');
          setClients([]);
          setPageInfo(null);
          setDelivery(null);
        }
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [attempt, filters, cursors, requestKey]);
  const formOpen = formToggled ?? (!!loadedKey && !hasClients && !listError);
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
        baseWeightKg: numberOrNull(form.baseWeightKg),
        baseBodyFatPercentage: numberOrNull(form.baseBodyFatPercentage),
        waistCm: numberOrNull(form.waistCm),
        hipCm: numberOrNull(form.hipCm),
      });
      setForm(emptyClientForm());
      setCursors([null]);
      setSearch('');
      setFilters((current) => ({ ...current, search: '', status: '' }));
      setSaved('El expediente se guardó correctamente.');
      setFormToggled(false);
      setAttempt((value) => value + 1);
      onStatusChanged();
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.fields);
        setError(Object.keys(failure.fields).length ? '' : failure.message);
      } else setError('No pudimos crear el expediente.');
    } finally {
      setBusy('');
    }
  }

  function updateField(field: ClientField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }
  return (
    <section className="space-y-5" aria-labelledby="portfolio-heading">
      <h2 id="portfolio-heading" className="sr-only">
        Acceso a expedientes
      </h2>
      {statusNotice && (
        <p className="ws-alert" data-tone="ok" role="status">
          {statusNotice}
        </p>
      )}
      <p className="ws-lead mt-0! mb-5!">
        Entrega una invitación privada al cliente de un expediente preparado.
        Reemplazarla invalida inmediatamente el código anterior. Se requiere
        expediente, profesional y suscripción activos.
      </p>
      {saved && (
        <p role="status" className="ws-alert" data-tone="ok">
          ✓ {saved}
        </p>
      )}
      <details
        className="ws-card ws-disclosure"
        open={formOpen}
        onToggle={(event) => setFormToggled(event.currentTarget.open)}
      >
        <summary>
          <Icon name="plus" size={18} />
          Nuevo expediente
        </summary>
        <form onSubmit={saveRecord} className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              Nombre completo
              <input
                required
                minLength={2}
                maxLength={150}
                value={form.fullName}
                onChange={(event) =>
                  updateField('fullName', event.target.value)
                }
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={
                  fieldErrors.fullName ? 'client-full-name-error' : undefined
                }
                className="block border p-2 rounded-lg w-full"
              />
              {fieldErrors.fullName && (
                <p
                  id="client-full-name-error"
                  className="text-red-700"
                  role="alert"
                >
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
                onChange={(event) =>
                  updateField('birthDate', event.target.value)
                }
                aria-invalid={!!fieldErrors.birthDate}
                aria-describedby={
                  fieldErrors.birthDate ? 'client-birth-date-error' : undefined
                }
                className="block border p-2 rounded-lg w-full"
              />
              <span className="text-sm">
                Solo se registran personas de 16 años o más.
              </span>
              {fieldErrors.birthDate && (
                <p
                  id="client-birth-date-error"
                  className="text-red-700"
                  role="alert"
                >
                  {fieldErrors.birthDate}
                </p>
              )}
            </label>
            <div className="contents">
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
                  onChange={(event) =>
                    updateField('heightCm', event.target.value)
                  }
                  aria-invalid={!!fieldErrors.heightCm}
                  aria-describedby={
                    fieldErrors.heightCm ? 'client-height-error' : undefined
                  }
                  className="block border p-2 rounded-lg w-full"
                />
                {fieldErrors.heightCm && (
                  <p
                    id="client-height-error"
                    className="text-red-700"
                    role="alert"
                  >
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
                  value={form.baseWeightKg}
                  onChange={(event) =>
                    updateField('baseWeightKg', event.target.value)
                  }
                  aria-invalid={!!fieldErrors.baseWeightKg}
                  aria-describedby={
                    fieldErrors.baseWeightKg ? 'client-weight-error' : undefined
                  }
                  className="block border p-2 rounded-lg w-full"
                />
                {fieldErrors.baseWeightKg && (
                  <p
                    id="client-weight-error"
                    className="text-red-700"
                    role="alert"
                  >
                    {fieldErrors.baseWeightKg}
                  </p>
                )}
              </label>
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend>Medidas base opcionales</legend>
            <p className="text-sm text-(--ws-muted)">
              Déjalas vacías si no se midieron todavía.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                Grasa medida (%)
                <input
                  type="number"
                  min="2"
                  max="60"
                  step="0.1"
                  inputMode="decimal"
                  value={form.baseBodyFatPercentage}
                  onChange={(event) =>
                    updateField('baseBodyFatPercentage', event.target.value)
                  }
                  aria-invalid={!!fieldErrors.baseBodyFatPercentage}
                  aria-describedby={
                    fieldErrors.baseBodyFatPercentage
                      ? 'client-body-fat-error'
                      : undefined
                  }
                  className="block border p-2 rounded-lg w-full"
                />
                {fieldErrors.baseBodyFatPercentage && (
                  <p
                    id="client-body-fat-error"
                    className="text-red-700"
                    role="alert"
                  >
                    {fieldErrors.baseBodyFatPercentage}
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
                  onChange={(event) =>
                    updateField('waistCm', event.target.value)
                  }
                  aria-invalid={!!fieldErrors.waistCm}
                  aria-describedby={
                    fieldErrors.waistCm ? 'client-waist-error' : undefined
                  }
                  className="block border p-2 rounded-lg w-full"
                />
                {fieldErrors.waistCm && (
                  <p
                    id="client-waist-error"
                    className="text-red-700"
                    role="alert"
                  >
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
                  aria-describedby={
                    fieldErrors.hipCm ? 'client-hip-error' : undefined
                  }
                  className="block border p-2 rounded-lg w-full"
                />
                {fieldErrors.hipCm && (
                  <p
                    id="client-hip-error"
                    className="text-red-700"
                    role="alert"
                  >
                    {fieldErrors.hipCm}
                  </p>
                )}
              </label>
            </div>
          </fieldset>
          <GoalField
            value={form.goal}
            onChange={(value) => updateField('goal', value)}
            error={fieldErrors.goal}
            errorId="client-goal-error"
            className="block border p-2 rounded-lg w-full"
          />
          <button
            disabled={!!busy}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {busy === 'new' ? 'Guardando…' : 'Crear expediente'}
          </button>
        </form>
      </details>
      <form
        aria-label="Buscar en mi cartera"
        className="ws-card flex flex-wrap items-end gap-3 p-4!"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if ([...search.trim()].length > 150) return;
          setAttempt((value) => value + 1);
          setCursors([null]);
          setFilters((current) => ({ ...current, search: search.trim() }));
        }}
      >
        <label className="min-w-56 flex-1">
          Buscar por nombre u objetivo
          <input
            className="block border rounded p-2"
            disabled={!!busy}
            value={search}
            ref={(input) => {
              input?.setCustomValidity(
                [...search.trim()].length > 150
                  ? 'La búsqueda admite hasta 150 caracteres.'
                  : ''
              );
            }}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Estado
          <select
            className="block border rounded p-2"
            disabled={!!busy}
            value={filters.status}
            onChange={(event) => {
              setCursors([null]);
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }));
            }}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>
        <label>
          Por página
          <select
            className="block border rounded p-2"
            disabled={!!busy}
            value={filters.pageSize}
            onChange={(event) => {
              setCursors([null]);
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value),
              }));
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button type="submit" disabled={!!busy} className="self-end">
          Buscar
        </button>
      </form>
      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Cargando expedientes…</span>
          <div className="ws-skeleton h-24" />
          <div className="ws-skeleton h-24" />
        </div>
      ) : listError ? (
        <div role="alert">
          <p>{listError}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Reintentar consulta
          </button>
        </div>
      ) : clients.length === 0 ? (
        <p className="ws-card ws-empty" role="status">
          {!hasClients
            ? 'Tu cartera está vacía.'
            : cursors.length > 1
              ? 'No quedan resultados en esta página. Vuelve a la anterior.'
              : 'No hay resultados para estos filtros.'}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {clients.map((record) => (
            <li key={record.id} className="ws-card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">
                    <Link
                      to={`/app/clientes/${record.id}`}
                      className="text-(--ws-primary-fg) hover:underline"
                    >
                      {record.fullName}
                    </Link>
                  </h3>
                  {record.goal && (
                    <p className="mt-0.5 text-sm text-(--ws-muted)">
                      {record.goal}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={record.status === 'active' ? 'ok' : 'neutral'}>
                    {record.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge
                    tone={
                      record.userId
                        ? record.accountStatus === 'inactive'
                          ? 'bad'
                          : 'info'
                        : 'neutral'
                    }
                  >
                    {record.userId
                      ? record.accountStatus === 'inactive'
                        ? 'Cuenta vinculada dada de baja'
                        : 'Cuenta vinculada'
                      : record.status !== 'active'
                        ? 'Expediente inactivo'
                        : 'Sin cuenta vinculada'}
                  </Badge>
                </div>
              </div>
              {record.invitationExpiresAt && (
                <p className="text-sm text-(--ws-muted)">
                  Invitación vigente hasta{' '}
                  {new Date(record.invitationExpiresAt).toLocaleString('es-MX')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <ClientStatusAction
                  sessionReady={sessionReady}
                  clientId={record.id}
                  status={record.status}
                  accountId={accountId}
                  disabled={!!busy}
                  onBusyChange={(pending) => {
                    setBusy(pending ? record.id : '');
                    if (pending) setDelivery(null);
                  }}
                  onChanged={(updated) => {
                    setStatusNotice(
                      `El expediente de ${updated.fullName} está ${updated.status === 'active' ? 'activo' : 'inactivo'}.`
                    );
                    setCursors([null]);
                    setAttempt((value) => value + 1);
                    onStatusChanged();
                  }}
                />
                {record.userId && record.accountStatus && (
                  <ClientAccountAction
                    sessionReady={sessionReady}
                    clientId={record.id}
                    fullName={record.fullName}
                    accountStatus={record.accountStatus}
                    accountId={accountId}
                    disabled={!!busy}
                    onBusyChange={(pending) => {
                      setBusy(pending ? record.id : '');
                      if (pending) setDelivery(null);
                    }}
                    onChanged={(status) => {
                      setStatusNotice(
                        `La cuenta de ${record.fullName} está ${status === 'active' ? 'activa' : 'dada de baja'}.`
                      );
                      setAttempt((value) => value + 1);
                    }}
                  />
                )}
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
              </div>
              {delivery?.clientId === record.id && (
                <div
                  role="status"
                  className="space-y-3 rounded-lg border border-(--ws-primary) bg-(--ws-selected) p-4"
                >
                  <h3 className="font-bold">
                    Invitación para {record.fullName}
                  </h3>
                  <p>
                    Entrega el código de forma privada. Solo se muestra en esta
                    entrega. Vence el{' '}
                    {new Date(delivery.expiresAt).toLocaleString('es-MX')}
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
                  <div className="flex flex-wrap gap-2">
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
                      className="px-4 py-2 rounded-lg"
                    >
                      Ocultar código
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <nav
        aria-label="Páginas de mi cartera"
        className="flex items-center justify-end gap-3 text-sm text-(--ws-muted)"
      >
        <button
          type="button"
          disabled={!!busy || loading || cursors.length <= 1}
          onClick={() => setCursors((current) => current.slice(0, -1))}
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
        >
          Anterior
        </button>
        <span>Página {cursors.length}</span>
        <button
          type="button"
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          disabled={!!busy || loading || !!listError || !pageInfo?.hasMore}
          onClick={() => {
            if (pageInfo?.nextCursor)
              setCursors((current) => [...current, pageInfo.nextCursor]);
          }}
        >
          Siguiente
        </button>
      </nav>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar consulta
          </button>
        </div>
      )}
    </section>
  );
}
