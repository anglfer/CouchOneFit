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
  currentFat = null,
}: {
  record: ClientBaseRecord;
  currentFat?: { value: number; date: string; estimated: boolean } | null;
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
    ...(currentFat
      ? ([
          [
            'Grasa corporal actual',
            `${currentFat.value.toFixed(1)} % · ${currentFat.estimated ? 'pliegues' : 'medida'}, ${new Date(`${currentFat.date}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`,
          ],
        ] as Array<[string, string]>)
      : []),
    ['Cintura inicial', value(record.waistCm, 'cm')],
    ['Cadera inicial', value(record.hipCm, 'cm')],
    ['Objetivo', record.goal ?? 'Sin registrar'],
  ];
  return (
    <>
      <dl className="divide-y divide-(--ws-border-subtle) text-sm">
        {items.map(([label, text]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="text-(--ws-muted)">{label}</dt>
            <dd
              className={
                text === 'Sin registrar'
                  ? 'text-right text-(--ws-muted)'
                  : 'text-right font-semibold'
              }
            >
              {text}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-(--ws-muted)">
        Datos de alta capturados por ti. No se dispone de una fecha de medición
        base.
      </p>
    </>
  );
}
