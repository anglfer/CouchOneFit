import type { ClientBaseRecord } from '../types/portfolio';

export default function ClientBaseDetails({
  record,
}: {
  record: ClientBaseRecord;
}) {
  const value = (number: number | null, unit: string) =>
    number === null ? 'Sin registrar' : `${number} ${unit}`;
  return (
    <>
      <dl className="space-y-2">
        <dt>Estado</dt>
        <dd>{record.status === 'active' ? 'Activo' : 'Inactivo'}</dd>
        <dt>Fecha de nacimiento</dt>
        <dd>{record.birthDate ?? 'Sin registrar'}</dd>
        <dt>Estatura</dt>
        <dd>{value(record.heightCm, 'cm')}</dd>
        <dt>Peso base</dt>
        <dd>{value(record.baseWeightKg, 'kg')}</dd>
        <dt>Grasa medida base</dt>
        <dd>{value(record.baseBodyFatPercentage, '%')}</dd>
        <dt>Cintura inicial</dt>
        <dd>{value(record.waistCm, 'cm')}</dd>
        <dt>Cadera inicial</dt>
        <dd>{value(record.hipCm, 'cm')}</dd>
        <dt>Objetivo</dt>
        <dd>{record.goal ?? 'Sin registrar'}</dd>
      </dl>
      <p>
        Datos base preparados por el profesional. El peso base está expresado en
        kg; no es un evento histórico ni una carga de entrenamiento. No se
        dispone de una fecha de medición base.
      </p>
    </>
  );
}
