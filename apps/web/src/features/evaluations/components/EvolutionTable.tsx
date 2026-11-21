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

function buildEvolutionRows(
  samples: EvolutionSample[],
  metric: EvolutionMetric
) {
  let previousValue: number | null = null;
  return samples.map((sample) => {
    const value = readEvolutionValue(sample, metric);
    const delta =
      typeof value === 'number' && previousValue !== null
        ? Number((value - previousValue).toFixed(1))
        : null;
    const sign =
      delta === null || Math.abs(delta) < 0.05
        ? 'flat'
        : delta > 0
          ? 'up'
          : 'down';
    if (typeof value === 'number') {
      previousValue = value;
    }
    return { sample, value, delta, sign };
  });
}

export default function EvolutionTable({
  samples,
  metric,
}: {
  samples: EvolutionSample[];
  metric: EvolutionMetric;
}) {
  const [label, unit] = evolutionMetrics[metric];
  const rows = buildEvolutionRows(samples, metric);

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
        <thead>
          <tr>
            {[
              'Fecha de evaluación',
              `${label} (${unit})`,
              'Cambio',
              'Método',
              'Procedencia',
            ].map((h) => (
              <th scope="col" key={h} className="px-3 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sample: s, value, delta, sign }) => (
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
              <td className="px-3 py-3 font-semibold tabular-nums">
                {value === undefined ? (
                  <span className="font-normal text-(--ws-muted)">
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
              <td className="px-3 py-3 tabular-nums">
                {delta === null ? (
                  <span className="text-xs text-(--ws-muted)">
                    {typeof value === 'number' ? 'Base' : '—'}
                  </span>
                ) : (
                  <span className="ws-delta" data-sign={sign}>
                    {Math.abs(delta) < 0.05
                      ? '0.0'
                      : `${delta > 0 ? '+' : '−'}${evolutionValue(Math.abs(delta))}`}{' '}
                    {unit}
                  </span>
                )}
              </td>
              <td className="px-3 py-3">{evolutionMethod(s.method)}</td>
              <td className="px-3 py-3">
                <span className="text-xs text-(--ws-muted)">
                  {evolutionProvenance(s.provenance)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
