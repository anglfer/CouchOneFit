import {
  evolutionMetrics,
  type EvolutionMetric,
  type EvolutionSample,
} from '../types/evolution';
import {
  evolutionDate,
  evolutionValue,
  evolutionMethod,
  evolutionProvenance,
  readEvolutionValue,
} from '../utils/evolution';
export default function EvolutionTable({
  samples,
  metric,
}: {
  samples: EvolutionSample[];
  metric: EvolutionMetric;
}) {
  const [label, unit] = evolutionMetrics[metric];
  return (
    <div
      className="overflow-x-auto rounded-xl border border-(--ws-border)"
      role="region"
      aria-label="Tabla histórica de evolución"
      tabIndex={0}
    >
      <table className="w-full text-left text-sm">
        <caption className="p-3 text-left font-semibold">
          {label} · {unit} · evaluaciones cargadas, orden cronológico
        </caption>
        <thead className="bg-(--ws-canvas)">
          <tr>
            {[
              'Fecha de evaluación',
              `${label} (${unit})`,
              'Método',
              'Origen',
              'Procedencia',
            ].map((h) => (
              <th scope="col" key={h} className="px-3 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {samples.map((s) => {
            const value = readEvolutionValue(s, metric);
            return (
              <tr key={s.id} className="border-t border-(--ws-border)">
                <th
                  scope="row"
                  className="px-3 py-3 font-normal normal-case tracking-normal"
                >
                  <time dateTime={s.date}>{evolutionDate(s.date)}</time>
                  {s.dateBasis !== 'effective_date' && (
                    <span className="block text-xs text-(--ws-muted)">
                      Fecha heredada de evaluación
                    </span>
                  )}
                </th>
                <td className="px-3 py-3 tabular-nums">
                  {value === undefined ? (
                    <span>
                      {metric === 'candidateBodyFat'
                        ? 'Sin estimación'
                        : 'Sin medición'}
                    </span>
                  ) : (
                    <>
                      {evolutionValue(value)} {unit}
                    </>
                  )}
                </td>
                <td className="px-3 py-3">{evolutionMethod(s.method)}</td>
                <td className="px-3 py-3">Evaluación profesional</td>
                <td className="px-3 py-3">
                  {evolutionProvenance(s.provenance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
