import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../services/api';
import {
  sessionMutationOnce,
  sessionRequest,
} from '../../auth/services/session';
import type { ClientBaseRecord } from '../types/portfolio';

const fields = [
  ['fullName', 'Nombre completo', 'text'],
  ['birthDate', 'Fecha de nacimiento', 'date'],
  ['heightCm', 'Estatura (cm)', 'number'],
  ['baseWeightKg', 'Peso base (kg)', 'number'],
  ['baseBodyFatPercentage', 'Grasa medida (%)', 'number'],
  ['waistCm', 'Cintura (cm)', 'number'],
  ['hipCm', 'Cadera (cm)', 'number'],
  ['goal', 'Objetivo (opcional)', 'text'],
] as const;
type Field = (typeof fields)[number][0];
const draftOf = (record: ClientBaseRecord) =>
  Object.fromEntries(
    fields.map(([key]) => [
      key,
      record[key] === null ? '' : String(record[key]),
    ])
  ) as Record<Field, string>;
const ranges: Partial<Record<Field, [number, number]>> = {
  heightCm: [100, 250],
  baseWeightKg: [30, 300],
  baseBodyFatPercentage: [2, 60],
  waistCm: [40, 250],
  hipCm: [50, 250],
};
function validateDraft(draft: Record<Field, string>, base: ClientBaseRecord) {
  const errors: Record<string, string> = {};
  const length = [...draft.fullName.trim()].length;
  if (length < 2 || length > 150)
    errors.fullName = 'Escribe un nombre completo de 2 a 150 caracteres.';
  if ([...draft.goal.trim()].length > 500)
    errors.goal = 'El objetivo admite hasta 500 caracteres.';
  const core = ['birthDate', 'heightCm', 'baseWeightKg'] as const;
  const required =
    base.birthDate !== null || core.some((key) => draft[key] !== '');
  for (const [key, , type] of fields) {
    if (required && core.includes(key as (typeof core)[number]) && !draft[key])
      errors[key] = 'Este dato es obligatorio.';
    if (type === 'number' && draft[key] !== '') {
      const number = Number(draft[key]),
        [min, max] = ranges[key]!;
      if (
        !Number.isFinite(number) ||
        number < min ||
        number > max ||
        Number(number.toFixed(1)) !== number
      )
        errors[key] =
          `Ingresa un valor entre ${min} y ${max} con incrementos de 0.1.`;
    }
  }
  if (draft.birthDate) {
    const date = new Date(`${draft.birthDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) ||
      draft.birthDate.startsWith('0000') ||
      !Number.isFinite(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== draft.birthDate
    )
      errors.birthDate = 'Ingresa una fecha de nacimiento válida.';
    else {
      date.setUTCFullYear(date.getUTCFullYear() + 18);
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const part = (type: string) => parts.find((p) => p.type === type)!.value;
      if (
        date >
        new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
      )
        errors.birthDate = 'El cliente debe tener al menos 18 años.';
    }
  }
  return errors;
}

export default function ClientRecordEditor({
  initial,
  accountId,
  onSaved,
  onCancel,
}: {
  initial: ClientBaseRecord;
  accountId: string;
  onSaved: (record: ClientBaseRecord) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [current, setCurrent] = useState<ClientBaseRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const url = `/api/clients/${encodeURIComponent(initial.id)}`;
  async function compare() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await sessionRequest<{ client: ClientBaseRecord }>(url);
      if (mounted.current) {
        setCurrent(result.client);
        setMessage(
          'Versión actual consultada. Tu borrador sigue intacto; compara antes de continuar.'
        );
      }
    } catch {
      if (mounted.current)
        setMessage(
          'No pudimos consultar el estado actual. Tu borrador se conserva.'
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || blocked) return;
    const validation = validateDraft(draft, base);
    if (Object.keys(validation).length) {
      setErrors(validation);
      setMessage('Revisa los campos marcados.');
      return;
    }
    const original = draftOf(base);
    const changes: Record<string, unknown> = {};
    for (const [key, , type] of fields)
      if (draft[key] !== original[key])
        changes[key] =
          type === 'number'
            ? draft[key] === ''
              ? null
              : Number(draft[key])
            : key === 'goal' && draft[key].trim() === ''
              ? null
              : draft[key];
    if (!Object.keys(changes).length) {
      setMessage('No hay cambios para guardar.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      const result = await sessionMutationOnce<{ client: ClientBaseRecord }>(
        url,
        { ...changes, version: base.version },
        'PATCH',
        accountId
      );
      if (mounted.current) onSaved(result.client);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError) {
        setErrors(error.fields);
        if (error.code === 'CLIENT_RECORD_CONFLICT') {
          setBlocked(true);
          setCurrent(null);
        }
        if (error.status >= 500) {
          setBlocked(true);
          setCurrent(null);
          setMessage(
            'No podemos confirmar si se guardó. Consulta el estado actual antes de decidir; no se reenviará automáticamente.'
          );
        } else setMessage(error.message);
      } else {
        setBlocked(true);
        setCurrent(null);
        setMessage(
          'Se perdió la respuesta. El resultado es incierto: consulta el estado actual. Tu borrador se conserva y no se reenviará automáticamente.'
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <form aria-label="Editar datos base" onSubmit={save} className="space-y-3">
      <h2 className="font-bold">Editar datos base y objetivo</h2>
      <p>
        Estos datos base no modifican evaluaciones fechadas ni registros
        históricos.
      </p>
      {base.birthDate === null && (
        <p>
          Expediente anterior incompleto. Al completar fecha, estatura o peso,
          completa los tres datos.
        </p>
      )}
      {fields.map(([key, label, type]) => (
        <label className="block" key={key}>
          {label}
          <input
            className="block border rounded p-2"
            type={type}
            step={type === 'number' ? '0.1' : undefined}
            disabled={busy}
            value={draft[key]}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `edit-${key}-error` : undefined}
            min={ranges[key]?.[0]}
            max={ranges[key]?.[1]}
            onChange={(event) =>
              setDraft((value) => ({ ...value, [key]: event.target.value }))
            }
          />
          {errors[key] && (
            <span id={`edit-${key}-error`} role="alert">
              {errors[key]}
            </span>
          )}
        </label>
      ))}
      {message && <p role="status">{message}</p>}
      {current && (
        <section aria-label="Comparar versión actual" className="border p-3">
          <h3>Versión actual: {current.version}</h3>
          <dl>
            {fields.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{current[key] ?? 'Sin registrar'}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const previous = draftOf(base),
                latest = draftOf(current);
              setDraft(
                (value) =>
                  Object.fromEntries(
                    fields.map(([key]) => [
                      key,
                      value[key] !== previous[key] ? value[key] : latest[key],
                    ])
                  ) as Record<Field, string>
              );
              setBase(current);
              setBlocked(false);
              setCurrent(null);
              setMessage(
                'Conservaste los campos que editaste sobre la versión consultada. Revisa y pulsa Guardar para reaplicar.'
              );
            }}
          >
            Usar esta versión para reaplicar mi borrador
          </button>
        </section>
      )}
      <button disabled={busy || blocked} type="submit">
        {busy ? 'Procesando…' : 'Guardar cambios'}
      </button>
      <button disabled={busy} type="button" onClick={() => void compare()}>
        Consultar estado actual
      </button>
      <button disabled={busy} type="button" onClick={onCancel}>
        Cancelar edición
      </button>
    </form>
  );
}
