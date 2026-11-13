import { useEffect, useId, useRef, useState } from 'react';
import type { EvolutionMetric, EvolutionSample } from '../types/evolution';
import { measurementFields } from '../types/assessment';
import {
  evolutionDate,
  evolutionValue,
  evolutionMethod,
  evolutionProvenance,
  compareHistory,
  evolutionSegments,
  evolutionSeparations,
  hasEvolutionMeasurement,
} from '../utils/evolution';
export default function EvolutionChart({
  samples,
  metric,
  hasMore = false,
}: {
  samples: EvolutionSample[];
  metric: EvolutionMetric;
  hasMore?: boolean;
}) {
  const id = useId(),
    container = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(640),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const size = () =>
      setWidth(Math.max(180, element.getBoundingClientRect().width || 640));
    size();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    observer?.observe(element);
    window.addEventListener('resize', size);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', size);
    };
  }, []);
  const points = samples
      .filter((s) => hasEvolutionMeasurement(s, metric))
      .sort(compareHistory),
    segments = evolutionSegments(samples, metric, hasMore),
    separations = evolutionSeparations(samples, metric, hasMore),
    [label, unit] = measurementFields[metric];
  if (points.length === 0) return null;
  const values = points.map((s) => s.measurements[metric]!),
    dates = points.map((s) => Date.parse(`${s.date}T00:00:00Z`));
  const first = Math.min(...dates),
    last = Math.max(...dates),
    low = Math.min(...values),
    high = Math.max(...values),
    pad = Math.max((high - low) * 0.12, 1),
    bottom = low - pad,
    top = high + pad;
  const x = (date: number) =>
    first === last
      ? width / 2
      : 60 + ((date - first) / (last - first)) * (width - 85);
  const y = (value: number) => 215 - ((value - bottom) / (top - bottom)) * 180;
  const chosen = points.find((s) => s.id === selected);
  return (
    <figure
      className="min-w-0 rounded-xl border border-(--ws-border) p-3"
      aria-labelledby={`${id}-title`}
    >
      <figcaption id={`${id}-title`} className="font-semibold">
        Gráfica de {label.toLowerCase()} ({unit})
      </figcaption>
      <p id={`${id}-description`} className="mt-1 text-sm text-(--ws-muted)">
        {metric === 'weightKg'
          ? 'Puntos: pesos reales en kg. Líneas: guías visuales entre fechas distintas, no pesos intermedios ni equivalencia clínica.'
          : 'Puntos: mediciones reales. Segmentos: capturas manuales del mismo método y protocolo; no representan mediciones intermedias ni predicciones.'}
      </p>
      <p className="mt-2 text-sm" role="status">
        {segments.length
          ? `${segments.length} ${metric === 'weightKg' ? 'guías de seguimiento' : 'segmentos entre registros comparables'}.`
          : 'Sin conexiones: los puntos permanecen separados.'}
        {metric === 'weightKg' &&
          segments.some((s) => s.heterogeneous) &&
          ' Línea discontinua: registros heterogéneos o equipo no identificado. No acredita equivalencia clínica.'}
        {metric === 'weightKg' &&
          ' Registros con la misma fecha y peso coinciden visualmente; cada uno conserva su ID.'}
      </p>
      {separations.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {separations.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {segments.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-2">
            Registros conectados ({segments.length})
          </summary>
          <ul className="space-y-2">
            {segments.map((s) => (
              <li key={`${s.from.id}:${s.to.id}`}>
                {evolutionDate(s.from.date)}:{' '}
                {evolutionValue(s.from.measurements[metric]!)} {unit} →{' '}
                {evolutionDate(s.to.date)}:{' '}
                {evolutionValue(s.to.measurements[metric]!)} {unit}.{' '}
                {s.heterogeneous
                  ? 'Guía entre registros heterogéneos.'
                  : 'Mismo contexto de captura declarado.'}
                <span className="block break-all text-xs">
                  IDs de inicio: {s.fromIds.join(', ')}. IDs de fin:{' '}
                  {s.toIds.join(', ')}.
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div ref={container} className="mt-3 min-w-0">
        <svg
          role="group"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          viewBox={`0 0 ${width} 270`}
          className="block w-full"
          style={{ height: 270 }}
        >
          <g aria-hidden="true" fontSize="12" fill="currentColor">
            {[bottom, (bottom + top) / 2, top].map((tick) => (
              <g key={tick}>
                <line
                  x1="55"
                  x2={width - 20}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--ws-border)"
                />
                <text x="48" y={y(tick) + 4} textAnchor="end">
                  {evolutionValue(tick)}
                </text>
              </g>
            ))}
            <text
              x={first === last ? width / 2 : 60}
              y="248"
              textAnchor={first === last ? 'middle' : 'start'}
            >
              {width < 420
                ? points[0].date.slice(8, 10) + '/' + points[0].date.slice(5, 7)
                : evolutionDate(points[0].date)}
            </text>
            {first !== last && (
              <text x={width - 25} y="248" textAnchor="end">
                {width < 420
                  ? points[points.length - 1].date.slice(8, 10) +
                    '/' +
                    points[points.length - 1].date.slice(5, 7)
                  : evolutionDate(points[points.length - 1].date)}
              </text>
            )}
          </g>
          <g aria-hidden="true">
            {segments.map(({ from, to, fromIds, toIds, heterogeneous }) => (
              <line
                key={`${from.id}:${to.id}`}
                data-evolution-segment="true"
                pointerEvents="none"
                data-from={from.id}
                data-to={to.id}
                data-from-ids={fromIds.join(',')}
                data-to-ids={toIds.join(',')}
                data-heterogeneous={heterogeneous ? 'true' : 'false'}
                x1={x(Date.parse(`${from.date}T00:00:00Z`))}
                y1={y(from.measurements[metric]!)}
                x2={x(Date.parse(`${to.date}T00:00:00Z`))}
                y2={y(to.measurements[metric]!)}
                stroke="var(--ws-primary)"
                strokeWidth="2"
                strokeDasharray={
                  metric === 'weightKg'
                    ? heterogeneous
                      ? '6 4'
                      : undefined
                    : from.method === 'pliegues'
                      ? '5 4'
                      : undefined
                }
              />
            ))}
          </g>
          {points.map((s, i) => {
            const cx = x(dates[i]),
              cy = y(values[i]);
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`Evaluación ${i + 1}: ${evolutionDate(s.date)}, ${evolutionValue(values[i])} ${unit}, ${evolutionMethod(s.method)}, evaluación profesional, ${evolutionProvenance(s.provenance)}. ID ${s.id}`}
                onFocus={() => setSelected(s.id)}
                onClick={() => setSelected(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(s.id);
                  }
                }}
                className="cursor-pointer focus:outline-none"
                style={{ color: 'var(--ws-primary)' }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r="22"
                  fill="transparent"
                  stroke={selected === s.id ? 'currentColor' : 'transparent'}
                  strokeWidth="2"
                />
                {s.method === 'pliegues' ? (
                  <path
                    d={`M${cx},${cy - 6} l6,6 -6,6 -6,-6 Z`}
                    fill="currentColor"
                  />
                ) : s.method === 'bioimpedancia' ? (
                  <rect
                    x={cx - 5}
                    y={cy - 5}
                    width="10"
                    height="10"
                    fill="currentColor"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="5"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill={
                      s.method === null ? 'var(--ws-surface)' : 'currentColor'
                    }
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-sm">
        Fechas: {evolutionDate(points[0].date)} —{' '}
        {evolutionDate(points[points.length - 1].date)}.
      </p>
      <p className="text-xs text-(--ws-muted)">
        Círculo: perímetros · Rombo: pliegues · Cuadrado: bioimpedancia ·
        Círculo vacío: heredada.{' '}
        {metric === 'weightKg'
          ? 'Línea discontinua: guía heterogénea; continua: mismo contexto declarado.'
          : 'Línea continua: perímetros; discontinua: pliegues. No se unen métodos distintos.'}{' '}
        Escala ajustada a los datos mostrados.
      </p>
      <p className="mt-2 text-sm" aria-live="polite">
        {chosen ? (
          <>
            {evolutionDate(chosen.date)} ·{' '}
            {evolutionValue(chosen.measurements[metric]!)} {unit} ·{' '}
            {evolutionMethod(chosen.method)} ·{' '}
            {evolutionProvenance(chosen.provenance)} · ID {chosen.id}
          </>
        ) : (
          'Usa Tab para enfocar cada registro o consulta todos los valores en la tabla.'
        )}
      </p>
    </figure>
  );
}
