import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import {
  createSlaRecord,
  deleteSlaRecord,
  measureSlaStorage,
  readSlaRecords,
} from '../services/observability';
import {
  SLA_RECORD_KINDS,
  type ObservabilityEnvironment,
  type SlaRecord,
  type SlaRecordKind,
} from '../types/observability';
import { formatMexicoDateTime, isSlaMonth } from '../utils/formatters';
import {
  buildSlaRecordBody,
  SLA_KIND_DEFS,
  slaKindLabel,
  type SlaFieldDef,
  type SlaFormValues,
} from '../utils/slaRecordForm';

function SlaField({
  field,
  value,
  onChange,
}: {
  field: SlaFieldDef;
  value: string | boolean | undefined;
  onChange: (next: string | boolean) => void;
}): ReactElement {
  const label = field.required ? `${field.label} (obligatorio)` : field.label;
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <label className="block text-sm">
        {label}
        <select
          className="ws-input mt-1 w-full min-h-10"
          value={typeof value === 'string' ? value : ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block text-sm">
      {label}
      <input
        type={
          field.type === 'datetime'
            ? 'datetime-local'
            : field.type === 'number'
              ? 'number'
              : 'text'
        }
        min={field.type === 'number' ? 0 : undefined}
        step={field.type === 'number' ? 'any' : undefined}
        className="ws-input mt-1 w-full min-h-10"
        value={typeof value === 'string' ? value : ''}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function summarizeDetails(details: Record<string, unknown>): string {
  const text = JSON.stringify(details);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function SlaRecordsPanel({
  environment,
  month,
  reloadTick,
  onChanged,
}: {
  environment: ObservabilityEnvironment;
  month: string;
  reloadTick: number;
  onChanged: () => void;
}): ReactElement {
  const formId = useId();
  const [records, setRecords] = useState<SlaRecord[] | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<SlaRecordKind>('support_incident');
  const [occurredAt, setOccurredAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [values, setValues] = useState<SlaFormValues>({});
  const [formError, setFormError] = useState('');

  const monthValid = isSlaMonth(month);
  const requestKey = `${environment}:${month}:${reloadTick}`;
  const loading = monthValid && loadedKey !== requestKey;
  const def = SLA_KIND_DEFS[kind];

  useEffect(() => {
    if (!monthValid) return;
    let active = true;
    void readSlaRecords(environment, month)
      .then((res) => {
        if (!active) return;
        setRecords(res);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setRecords(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos leer la bitácora SLA.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, month, monthValid, requestKey]);

  function changeKind(next: SlaRecordKind): void {
    setKind(next);
    setEndedAt('');
    setValues({});
    setFormError('');
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError('');
    setNotice('');
    const result = buildSlaRecordBody(
      environment,
      kind,
      occurredAt,
      endedAt,
      values
    );
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setBusy(true);
    try {
      await createSlaRecord(result.body);
      setNotice('Registro guardado en la bitácora SLA.');
      setOccurredAt('');
      setEndedAt('');
      setValues({});
      onChanged();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos guardar el registro.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(record: SlaRecord): Promise<void> {
    if (
      !(await confirmDialog({
        title: '¿Eliminar registro de la bitácora SLA?',
        message: `Se eliminará «${slaKindLabel(record.kind)}» del ${formatMexicoDateTime(record.occurredAt)}. El cálculo del SLA cambiará.`,
        confirmLabel: 'Eliminar',
      }))
    ) {
      return;
    }
    setNotice('');
    setError('');
    try {
      await deleteSlaRecord(record.id);
      setNotice('Registro eliminado.');
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos eliminar el registro.'
      );
    }
  }

  async function handleStorage(): Promise<void> {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await measureSlaStorage(environment);
      setNotice('Almacenamiento medido y registrado.');
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos medir el almacenamiento.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Bitácora SLA"
      subtitle="Eventos operativos que alimentan el cálculo: mantenimientos, incidentes, respaldos, simulacros, despliegues y más."
      icon="clipboard"
      labelId="sla-records-title"
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ws-btn"
            disabled={busy}
            onClick={() => void handleStorage()}
          >
            Medir almacenamiento
          </button>
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            aria-expanded={formOpen}
            aria-controls={formId}
            onClick={() => setFormOpen((open) => !open)}
          >
            <Icon name={formOpen ? 'close' : 'plus'} size={16} />
            {formOpen ? 'Cerrar formulario' : 'Agregar registro'}
          </button>
        </div>
      }
    >
      <div aria-live="polite" className="space-y-2">
        {notice && (
          <p role="status" className="ws-alert" data-tone="ok">
            {notice}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {formOpen && (
        <form
          id={formId}
          className="my-3 space-y-3 rounded-lg border border-(--ws-border-subtle) p-3"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <p className="text-xs text-(--ws-muted)">
            Las fechas se capturan en hora de la Ciudad de México (UTC-6) y se
            guardan en UTC.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">
              Tipo de registro
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={kind}
                onChange={(e) => changeKind(e.target.value as SlaRecordKind)}
              >
                {SLA_RECORD_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {SLA_KIND_DEFS[item].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              {def.startLabel} (obligatorio)
              <input
                type="datetime-local"
                className="ws-input mt-1 w-full min-h-10"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </label>
            {def.endLabel && (
              <label className="block text-sm">
                {def.endRequired
                  ? `${def.endLabel} (obligatorio)`
                  : def.endLabel}
                <input
                  type="datetime-local"
                  className="ws-input mt-1 w-full min-h-10"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                />
              </label>
            )}
            {def.fields.map((field) => (
              <SlaField
                key={`${kind}:${field.key}`}
                field={field}
                value={values[field.key]}
                onChange={(next) =>
                  setValues((prev) => ({ ...prev, [field.key]: next }))
                }
              />
            ))}
          </div>
          {formError && (
            <p role="alert" className="ws-alert" data-tone="bad">
              {formError}
            </p>
          )}
          <button
            type="submit"
            className="ws-btn"
            data-variant="primary"
            disabled={busy}
          >
            Guardar registro
          </button>
        </form>
      )}

      {!monthValid ? (
        <p className="ws-empty">Selecciona un mes válido.</p>
      ) : loading ? (
        <p className="ws-empty" role="status" aria-busy="true">
          Cargando bitácora…
        </p>
      ) : records ? (
        records.length === 0 ? (
          <p className="ws-empty">No hay registros en la bitácora del mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Registros de la bitácora SLA
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2">
                    Tipo
                  </th>
                  <th scope="col" className="p-2">
                    Inicio
                  </th>
                  <th scope="col" className="p-2">
                    Fin
                  </th>
                  <th scope="col" className="p-2">
                    Origen
                  </th>
                  <th scope="col" className="p-2">
                    Detalle
                  </th>
                  <th scope="col" className="p-2">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-t border-(--ws-border-subtle)"
                  >
                    <th scope="row" className="p-2 font-semibold">
                      {slaKindLabel(record.kind)}
                    </th>
                    <td className="p-2 whitespace-nowrap">
                      {formatMexicoDateTime(record.occurredAt)}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {formatMexicoDateTime(record.endedAt)}
                    </td>
                    <td className="p-2">
                      <Badge
                        tone={
                          record.source === 'automation' ? 'info' : 'neutral'
                        }
                      >
                        {record.source === 'automation'
                          ? 'Automático'
                          : 'Manual'}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono break-all">
                      {summarizeDetails(record.details)}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="ws-btn min-h-8 px-3 py-1 text-xs"
                        aria-label={`Eliminar ${slaKindLabel(record.kind)} del ${formatMexicoDateTime(record.occurredAt)}`}
                        onClick={() => void handleDelete(record)}
                      >
                        <Icon name="trash" size={14} />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </Card>
  );
}
