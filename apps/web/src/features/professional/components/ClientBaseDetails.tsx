import type { ClientBaseRecord } from '../types/portfolio';

// birthDate is a calendar date; format it without shifting through UTC.
const calendarDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export default function ClientBaseDetails({
  record,
}: {
  record: ClientBaseRecord;
}) {
  const value = (number: number | null, unit: string) =>
    number === null ? 'Sin registrar' : `${number} ${unit}`;
  const items: Array<[string, string]> = [
    ['Estado', record.status === 'active' ? 'Activo' : 'Inactivo'],
    [
      'Fecha de nacimiento',
      record.birthDate ? calendarDate(record.birthDate) : 'Sin registrar',
    ],
    ['Estatura', value(record.heightCm, 'cm')],
    ['Peso base', value(record.baseWeightKg, 'kg')],
    ['Grasa medida base', value(record.baseBodyFatPercentage, '%')],
    ['Cintura inicial', value(record.waistCm, 'cm')],
    ['Cadera inicial', value(record.hipCm, 'cm')],
    ['Objetivo', record.goal ?? 'Sin registrar'],
  ];
  return (
    <>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(([label, text]) => (
          <div key={label} className="rounded-lg bg-(--ws-surface-2) px-4 py-3">
            <dt className="text-xs font-semibold text-(--ws-muted)">{label}</dt>
            <dd className="font-semibold">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-(--ws-muted)">
        Datos base preparados por el profesional. El peso base está expresado en
        kg; no es un evento histórico ni una carga de entrenamiento. No se
        dispone de una fecha de medición base.
      </p>
    </>
  );
}
