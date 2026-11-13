import type { EvolutionMetric, EvolutionSample } from '../types/evolution';
import { measurementFields } from '../types/assessment';
import {
  evolutionDate,
  evolutionValue,
  evolutionMethod,
  evolutionProvenance,
} from '../utils/evolution';
export default function EvolutionTable({
  samples,
  metric,
}: {
  samples: EvolutionSample[];
  metric: EvolutionMetric;
}) {
  const [label, unit] = measurementFields[metric];
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
          {samples.map((s) => (
            <tr key={s.id} className="border-t border-(--ws-border)">
              <th scope="row" className="px-3 py-3 font-normal">
                <time dateTime={s.date}>{evolutionDate(s.date)}</time>
                <span className="block text-xs text-(--ws-muted)">
                  {s.dateBasis === 'effective_date'
                    ? 'Fecha efectiva'
                    : 'Fecha heredada de evaluación'}
                </span>
                <details className="mt-1">
                  <summary className="flex min-h-11 cursor-pointer items-center py-1">
                    Identificador
                  </summary>
                  <code className="block max-w-44 break-all text-xs">
                    {s.id}
                  </code>
                  <span className="block text-xs">Creada: {s.createdAt}</span>
                </details>
              </th>
              <td className="px-3 py-3 tabular-nums">
                {s.measurements[metric] === undefined ? (
                  <span>Sin medición</span>
                ) : (
                  <>
                    {evolutionValue(s.measurements[metric])} {unit}
                  </>
                )}
              </td>
              <td className="px-3 py-3">
                {evolutionMethod(s.method)}
                {s.protocol && (
                  <span className="block text-xs text-(--ws-muted)">
                    Protocolo: {s.protocol}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">Evaluación profesional</td>
              <td className="px-3 py-3">{evolutionProvenance(s.provenance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
