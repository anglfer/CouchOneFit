import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import type { TimeSeriesPoint } from '../types/observability';
import { formatDateTime } from '../utils/formatters';

function buildPolyline(points: Array<{ x: number; y: number | null }>): string {
  return points
    .filter((p): p is { x: number; y: number } => p.y !== null)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

export function ObservabilityCharts({
  history,
}: {
  history: TimeSeriesPoint[];
}): ReactElement {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const resize = () =>
      setWidth(Math.max(240, el.getBoundingClientRect().width || 640));
    resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (history.length === 0) {
    return (
      <section className="ws-card ws-empty" aria-label="Gráficas históricas">
        <p className="font-semibold text-(--ws-text)">
          Sin serie histórica en la ventana seleccionada
        </p>
        <p>
          Las gráficas aparecerán en cuanto existan solicitudes reales o
          comprobaciones registradas en este ambiente y periodo.
        </p>
      </section>
    );
  }

  const latValues = history
    .flatMap((p) => [p.latencyP50Ms, p.latencyP95Ms])
    .filter((v): v is number => v !== null);
  const maxLat = latValues.length ? Math.max(...latValues, 100) : 1000;
  const xPos = (idx: number) =>
    history.length === 1
      ? width / 2
      : 54 + (idx / (history.length - 1)) * (width - 80);
  const yLat = (val: number | null) =>
    val === null ? null : 185 - Math.min(1, val / maxLat) * 150;
  const yPct = (val: number | null) =>
    val === null ? null : 185 - Math.min(100, Math.max(0, val)) * 1.5;

  const p95Points = history.map((p, i) => ({
    x: xPos(i),
    y: yLat(p.latencyP95Ms),
  }));
  const p50Points = history.map((p, i) => ({
    x: xPos(i),
    y: yLat(p.latencyP50Ms),
  }));
  const availPoints = history.map((p, i) => ({
    x: xPos(i),
    y: yPct(p.availabilityPct),
  }));
  const chosen = selectedIdx !== null ? history[selectedIdx] : null;

  return (
    <figure
      className="ws-card min-w-0 space-y-3"
      aria-labelledby={`${id}-chart-title`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <figcaption id={`${id}-chart-title`} className="ws-card-title">
            Comportamiento histórico: latencia (ms) y disponibilidad (%)
          </figcaption>
          <p className="ws-card-sub">
            {formatDateTime(history[0].bucket)} —{' '}
            {formatDateTime(history[history.length - 1].bucket)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-(--ws-muted)">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded"
              style={{ background: 'var(--ws-primary)' }}
            />
            Latencia P95 (ms)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded"
              style={{ background: 'var(--ws-ok-fg)' }}
            />
            Disponibilidad (%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 border-t-2 border-dashed"
              style={{ borderColor: 'var(--ws-info-fg)' }}
            />
            Latencia P50 (ms)
          </span>
        </div>
      </div>

      <div ref={container} className="min-w-0">
        <svg
          role="group"
          aria-labelledby={`${id}-chart-title`}
          viewBox={`0 0 ${width} 225`}
          className="block w-full"
          style={{ height: 225 }}
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = 185 - ratio * 150;
            return (
              <g key={ratio} aria-hidden="true">
                <line
                  x1="50"
                  x2={width - 24}
                  y1={y}
                  y2={y}
                  stroke="var(--ws-border)"
                  strokeDasharray="3 4"
                />
                <text
                  x="44"
                  y={y + 4}
                  fontSize="11"
                  textAnchor="end"
                  fill="var(--ws-muted)"
                >
                  {Math.round(ratio * maxLat)}
                </text>
              </g>
            );
          })}

          {buildPolyline(p50Points) && (
            <polyline
              fill="none"
              stroke="var(--ws-info-fg)"
              strokeWidth="2"
              strokeDasharray="5 4"
              points={buildPolyline(p50Points)}
            />
          )}
          {buildPolyline(p95Points) && (
            <polyline
              fill="none"
              stroke="var(--ws-primary)"
              strokeWidth="2.5"
              points={buildPolyline(p95Points)}
            />
          )}
          {buildPolyline(availPoints) && (
            <polyline
              fill="none"
              stroke="var(--ws-ok-fg)"
              strokeWidth="2"
              points={buildPolyline(availPoints)}
            />
          )}

          {history.map((point, idx) => {
            const cx = xPos(idx);
            const cy =
              yLat(point.latencyP95Ms) ?? yPct(point.availabilityPct) ?? 185;
            return (
              <g
                key={point.bucket}
                role="button"
                tabIndex={0}
                aria-label={`Bloque ${formatDateTime(point.bucket)}: ${point.requestsTotal} solicitudes, P95 ${point.latencyP95Ms ?? 'n/d'} ms, disponibilidad ${point.availabilityPct ?? 'n/d'} %`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onFocus={() => setSelectedIdx(idx)}
                onClick={() => setSelectedIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedIdx(idx);
                  }
                }}
                className="cursor-pointer focus:outline-none"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill="transparent"
                  stroke={
                    selectedIdx === idx ? 'var(--ws-primary)' : 'transparent'
                  }
                  strokeWidth="1.5"
                />
                <circle cx={cx} cy={cy} r="4" fill="var(--ws-primary)" />
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-sm text-(--ws-text-2)" aria-live="polite">
        {chosen ? (
          <>
            <strong>{formatDateTime(chosen.bucket)}</strong> · Solicitudes:{' '}
            {chosen.requestsTotal} · P50: {chosen.latencyP50Ms ?? 'n/d'} ms ·
            P95: {chosen.latencyP95Ms ?? 'n/d'} ms · Error:{' '}
            {chosen.errorRatePct ?? 'n/d'} % · Disponibilidad:{' '}
            {chosen.availabilityPct ?? 'n/d'} % · Pruebas: {chosen.checksPassed}{' '}
            ok / {chosen.checksFailed} fallo
          </>
        ) : (
          'Selecciona un punto de la gráfica para inspeccionar el bloque horario.'
        )}
      </p>

      <details className="text-sm text-(--ws-muted)">
        <summary className="min-h-10 cursor-pointer py-1 font-medium text-(--ws-text)">
          Tabla histórica detallada ({history.length} bloques)
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-2">Bloque</th>
                <th className="p-2">Solicitudes</th>
                <th className="p-2">Error 5xx %</th>
                <th className="p-2">P50 (ms)</th>
                <th className="p-2">P95 (ms)</th>
                <th className="p-2">Disp. (%)</th>
                <th className="p-2">Pruebas ok / fallo</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.bucket}>
                  <td className="p-2 whitespace-nowrap">
                    {formatDateTime(row.bucket)}
                  </td>
                  <td className="p-2 tabular-nums">{row.requestsTotal}</td>
                  <td className="p-2 tabular-nums">
                    {row.errorRatePct ?? 'n/d'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.latencyP50Ms ?? 'n/d'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.latencyP95Ms ?? 'n/d'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.availabilityPct ?? 'n/d'}
                  </td>
                  <td className="p-2 tabular-nums">
                    {row.checksPassed} / {row.checksFailed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
