import { useId, useState } from 'react';
import {
  measurementFields,
  type MeasurementField,
  type Method,
} from '../types/assessment';
import {
  BACK_LANDMARKS,
  BACK_MUSCLES,
  BODY_SILHOUETTE_PATH,
  EARS_PATH,
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  FRONT_LANDMARKS,
  FRONT_MUSCLES,
  HEAD_BACK_PATH,
  HEAD_FRONT_PATH,
  SITE_MARKERS,
  type BodySide,
  type MuscleGroupId,
  type SiteMarker,
} from '../utils/anatomicalFigure';

type ZoomLevel = 'overview' | 'near' | 'macro';

const ZOOM_SCALE: Record<ZoomLevel, number> = {
  overview: 1,
  near: 2.2,
  macro: 2.8,
};

function bandCurvePath(
  leftX: number,
  rightX: number,
  y: number,
  dip: number
): string {
  const midX = (leftX + rightX) / 2;
  return `M ${leftX} ${y} Q ${midX} ${y + dip} ${rightX} ${y}`;
}

function bandCenterY(marker: SiteMarker): number {
  return marker.kind === 'perimeter' && marker.x === FIGURE_WIDTH / 2
    ? marker.y + (marker.bandDip ?? 3) * 0.5
    : marker.y;
}

function computeCanvasTransform(
  side: BodySide,
  marker: SiteMarker | null,
  targetScale: number
): { scale: number; txPct: number; tyPct: number } {
  if (!marker || targetScale <= 1) {
    return { scale: 1, txPct: 0, tyPct: 0 };
  }
  const target =
    side === marker.side
      ? marker.focusCenter
      : side === 'back' && marker.backBand
        ? { x: FIGURE_WIDTH / 2, y: marker.backBand.y }
        : null;
  if (!target) {
    return { scale: 1, txPct: 0, tyPct: 0 };
  }
  const minOffset = -(targetScale - 1) * 100;
  const rawTx = 50 - targetScale * ((target.x / FIGURE_WIDTH) * 100);
  const rawTy = 50 - targetScale * ((target.y / FIGURE_HEIGHT) * 100);
  return {
    scale: targetScale,
    txPct: Math.max(minOffset, Math.min(0, Number(rawTx.toFixed(2)))),
    tyPct: Math.max(minOffset, Math.min(0, Number(rawTy.toFixed(2)))),
  };
}

export default function AnatomicalGuide({
  active,
  onSelect,
  method,
  requiredFields = [],
}: {
  active: MeasurementField | null;
  onSelect: (key: MeasurementField) => void;
  method?: Method;
  requiredFields?: readonly MeasurementField[];
}) {
  const uid = useId();
  const [hovered, setHovered] = useState<MeasurementField | null>(null);
  const [focusedPin, setFocusedPin] = useState<MeasurementField | null>(null);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('near');
  const [trackedActive, setTrackedActive] = useState(active);

  if (active !== trackedActive) {
    setTrackedActive(active);
    if (active && zoomLevel === 'overview') {
      setZoomLevel('near');
    }
  }

  const visibleMarkers =
    method === 'perimetros' || method === 'pliegues'
      ? SITE_MARKERS.filter((item) => item.method === method)
      : SITE_MARKERS;

  const focusField = hovered ?? focusedPin ?? active;
  const focusMarker =
    visibleMarkers.find((item) => item.field === focusField) ?? null;
  const zoomTargetField = focusedPin ?? active;
  const zoomTargetMarker =
    visibleMarkers.find((item) => item.field === zoomTargetField) ?? null;

  const effectiveZoomLevel: ZoomLevel =
    zoomTargetMarker && zoomLevel !== 'overview' ? zoomLevel : 'overview';
  const targetScale = ZOOM_SCALE[effectiveZoomLevel];

  const activeMuscles = new Set<MuscleGroupId>(focusMarker?.muscles ?? []);
  const requiredSet = new Set<MeasurementField>(requiredFields);

  function handleSelect(field: MeasurementField) {
    if (zoomLevel === 'overview') {
      setZoomLevel('near');
    }
    onSelect(field);
  }

  function handleZoomChange(nextLevel: ZoomLevel) {
    setZoomLevel(nextLevel);
    if (
      nextLevel !== 'overview' &&
      !zoomTargetMarker &&
      visibleMarkers.length > 0
    ) {
      onSelect(visibleMarkers[0].field);
    }
  }

  return (
    <section
      aria-label="Referencia anatómica"
      className="rounded-lg border border-(--ws-border) p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="font-semibold">Referencia anatómica</h3>
          {method && (
            <span className="text-xs font-semibold text-(--ws-primary-fg)">
              {method === 'perimetros'
                ? 'Cinta · 4 sitios'
                : 'Plicómetro · 7 sitios'}
            </span>
          )}
        </div>
        <div
          role="group"
          aria-label="Nivel de acercamiento"
          className="flex flex-wrap items-center gap-1"
        >
          {(
            [
              ['overview', 'Completa', 'Completa · todo el cuerpo'],
              ['near', 'Acercar', 'Acercar zona muscular'],
              ['macro', 'Detalle', 'Detalle ampliado de la zona'],
            ] as const
          ).map(([level, text, ariaLabel]) => (
            <button
              key={level}
              type="button"
              aria-label={ariaLabel}
              aria-pressed={effectiveZoomLevel === level}
              onClick={() => handleZoomChange(level)}
              className="ws-btn anatomical-zoom-btn min-h-8 px-2.5 py-1 text-xs"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-(--ws-muted)">
        Esquema orientativo. Al seleccionar una zona o campo se acerca el
        músculo para ubicar el sitio de medición.
      </p>

      <div className="anatomical-stage grid grid-cols-2 gap-3 rounded-xl border border-(--ws-border-subtle) p-3">
        {(['front', 'back'] as const).map((side: BodySide) => {
          const sideMarkers = visibleMarkers.filter(
            (item) => item.side === side
          );
          const muscles = side === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;
          const landmarks = side === 'front' ? FRONT_LANDMARKS : BACK_LANDMARKS;
          const headPath = side === 'front' ? HEAD_FRONT_PATH : HEAD_BACK_PATH;
          const backContinuation =
            side === 'back' && focusMarker?.backBand
              ? focusMarker.backBand
              : null;

          const {
            scale: sideScale,
            txPct,
            tyPct,
          } = computeCanvasTransform(side, zoomTargetMarker, targetScale);
          const isZoomedSide = sideScale > 1;
          const markerScale = isZoomedSide
            ? Number((1 / Math.pow(sideScale, 0.72)).toFixed(3))
            : 1;

          return (
            <div key={side} className="flex flex-col items-center gap-1.5">
              <div className="flex w-full max-w-[12rem] items-center justify-between px-0.5">
                <p className="text-xs font-semibold tracking-wide text-(--ws-text-2)">
                  {side === 'front' ? 'Frente' : 'Espalda'}
                </p>
                <span className="text-[11px] font-medium text-(--ws-muted)">
                  {isZoomedSide ? `${sideScale.toFixed(1)}×` : '1×'}
                </span>
              </div>

              <div
                role="group"
                aria-label={
                  side === 'front' ? 'Vista anterior' : 'Vista posterior'
                }
                data-zoomed={isZoomedSide || undefined}
                className="anatomical-viewport relative w-full max-w-[12rem] aspect-[220/470] overflow-hidden rounded-lg border border-(--ws-border-subtle)"
              >
                <div
                  className="anatomical-canvas relative h-full w-full"
                  style={{
                    translate: `${txPct}% ${tyPct}%`,
                    scale: String(sideScale),
                  }}
                >
                  <svg
                    viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
                    aria-hidden="true"
                    className="block h-full w-full select-none overflow-visible"
                  >
                    <defs>
                      <clipPath id={`${uid}-body-clip-${side}`}>
                        <path d={BODY_SILHOUETTE_PATH} />
                      </clipPath>
                      <clipPath id={`${uid}-head-clip-${side}`}>
                        <path d={headPath} />
                      </clipPath>

                      <radialGradient
                        id={`${uid}-skin-${side}`}
                        cx="46%"
                        cy="32%"
                        r="68%"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--ws-surface)"
                          stopOpacity="0.96"
                        />
                        <stop
                          offset="58%"
                          stopColor="var(--ws-surface-2)"
                          stopOpacity="0.98"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--ws-border)"
                          stopOpacity="0.92"
                        />
                      </radialGradient>

                      <linearGradient
                        id={`${uid}-torso-sheen-${side}`}
                        x1="20%"
                        y1="0%"
                        x2="80%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--ws-on-primary)"
                          stopOpacity="0.1"
                        />
                        <stop
                          offset="45%"
                          stopColor="var(--ws-on-primary)"
                          stopOpacity="0.02"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--ws-text)"
                          stopOpacity="0.1"
                        />
                      </linearGradient>

                      <linearGradient
                        id={`${uid}-muscle-idle-${side}`}
                        x1="15%"
                        y1="0%"
                        x2="85%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--ws-muted)"
                          stopOpacity="0.18"
                        />
                        <stop
                          offset="52%"
                          stopColor="var(--ws-muted)"
                          stopOpacity="0.34"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--ws-text)"
                          stopOpacity="0.22"
                        />
                      </linearGradient>

                      <linearGradient
                        id={`${uid}-muscle-active-${side}`}
                        x1="12%"
                        y1="0%"
                        x2="88%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--ws-primary-hover)"
                          stopOpacity="0.72"
                        />
                        <stop
                          offset="48%"
                          stopColor="var(--ws-primary)"
                          stopOpacity="0.92"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--ws-primary-hover)"
                          stopOpacity="0.98"
                        />
                      </linearGradient>

                      <linearGradient
                        id={`${uid}-muscle-req-${side}`}
                        x1="10%"
                        y1="0%"
                        x2="90%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--ws-primary)"
                          stopOpacity="0.24"
                        />
                        <stop
                          offset="55%"
                          stopColor="var(--ws-primary)"
                          stopOpacity="0.4"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--ws-primary-hover)"
                          stopOpacity="0.52"
                        />
                      </linearGradient>
                    </defs>

                    {/* Base anatomical silhouette + 3D cylindrical volume shading */}
                    <path
                      d={BODY_SILHOUETTE_PATH}
                      fill={`url(#${uid}-skin-${side})`}
                      className="anatomical-silhouette"
                    />
                    <g clipPath={`url(#${uid}-body-clip-${side})`}>
                      <rect
                        x="0"
                        y="0"
                        width={FIGURE_WIDTH}
                        height={FIGURE_HEIGHT}
                        fill={`url(#${uid}-torso-sheen-${side})`}
                      />
                      <path
                        d={BODY_SILHOUETTE_PATH}
                        fill="none"
                        stroke="var(--ws-text)"
                        strokeOpacity="0.14"
                        strokeWidth="5.5"
                      />
                    </g>
                    <path
                      d={BODY_SILHOUETTE_PATH}
                      fill="none"
                      stroke="var(--ws-muted)"
                      strokeOpacity="0.55"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      className="anatomical-silhouette"
                    />

                    {/* Sculpted anatomical muscle groups */}
                    <g className="anatomical-muscles">
                      {muscles.map((muscle) => {
                        const isHighlighted = activeMuscles.has(muscle.group);
                        const isRequiredGroup =
                          !isHighlighted &&
                          visibleMarkers.some(
                            (m) =>
                              requiredSet.has(m.field) &&
                              m.muscles.includes(muscle.group)
                          );
                        const fill = isHighlighted
                          ? `url(#${uid}-muscle-active-${side})`
                          : isRequiredGroup
                            ? `url(#${uid}-muscle-req-${side})`
                            : `url(#${uid}-muscle-idle-${side})`;

                        return (
                          <g key={muscle.id}>
                            <path
                              d={muscle.path}
                              fill={fill}
                              stroke={
                                isHighlighted
                                  ? 'var(--ws-primary-fg)'
                                  : 'var(--ws-surface)'
                              }
                              strokeOpacity={isHighlighted ? 0.85 : 0.72}
                              strokeWidth={isHighlighted ? 1.15 : 0.9}
                              strokeLinejoin="round"
                              className="anatomical-muscle"
                              data-active={isHighlighted || undefined}
                            />
                            {isHighlighted && (
                              <path
                                d={muscle.path}
                                fill="none"
                                stroke="var(--ws-on-primary)"
                                strokeOpacity="0.28"
                                strokeWidth="0.65"
                                strokeLinejoin="round"
                              />
                            )}
                            {muscle.striations.map((line, index) => (
                              <path
                                key={index}
                                d={line}
                                fill="none"
                                stroke={
                                  isHighlighted
                                    ? 'var(--ws-on-primary)'
                                    : 'var(--ws-text)'
                                }
                                strokeOpacity={isHighlighted ? 0.48 : 0.16}
                                strokeWidth="0.65"
                                strokeLinecap="round"
                              />
                            ))}
                          </g>
                        );
                      })}
                    </g>

                    {/* Anatomical fascia, bone & tendon landmarks */}
                    <g
                      fill="none"
                      stroke="var(--ws-text)"
                      strokeOpacity="0.25"
                      strokeWidth="0.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {landmarks.map((d, index) => (
                        <path key={index} d={d} />
                      ))}
                    </g>

                    {/* Head & ears rendered over upper neck seam with volume */}
                    <path
                      d={EARS_PATH}
                      fill={`url(#${uid}-skin-${side})`}
                      stroke="var(--ws-muted)"
                      strokeOpacity="0.5"
                      strokeWidth="1.1"
                    />
                    <path
                      d={headPath}
                      fill={`url(#${uid}-skin-${side})`}
                      className="anatomical-silhouette"
                    />
                    <path
                      d={headPath}
                      clipPath={`url(#${uid}-head-clip-${side})`}
                      fill="none"
                      stroke="var(--ws-text)"
                      strokeOpacity="0.14"
                      strokeWidth="4.5"
                    />
                    <path
                      d={headPath}
                      fill="none"
                      stroke="var(--ws-muted)"
                      strokeOpacity="0.54"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      className="anatomical-silhouette"
                    />
                    {side === 'front' ? (
                      <path
                        d="M 96 47 Q 101 55.5 110 58.5 Q 119 55.5 124 47 M 106.5 62.5 Q 110 64 113.5 62.5"
                        fill="none"
                        stroke="var(--ws-muted)"
                        strokeOpacity="0.28"
                        strokeWidth="0.85"
                        strokeLinecap="round"
                      />
                    ) : (
                      <path
                        d="M 96 49 Q 110 56 124 49 M 104 54 Q 110 57 116 54"
                        fill="none"
                        stroke="var(--ws-muted)"
                        strokeOpacity="0.32"
                        strokeWidth="0.9"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Posterior tape continuation for active perimeter */}
                    {backContinuation && (
                      <g>
                        <path
                          d={bandCurvePath(
                            backContinuation.leftX,
                            backContinuation.rightX,
                            backContinuation.y,
                            -backContinuation.dip
                          )}
                          fill="none"
                          stroke="var(--ws-surface)"
                          strokeOpacity="0.72"
                          strokeWidth={3.2 * markerScale}
                          strokeLinecap="round"
                        />
                        <path
                          d={bandCurvePath(
                            backContinuation.leftX,
                            backContinuation.rightX,
                            backContinuation.y,
                            -backContinuation.dip
                          )}
                          fill="none"
                          stroke="var(--ws-primary)"
                          strokeWidth={1.8 * markerScale}
                          strokeDasharray={`${3.5 * markerScale} ${2.5 * markerScale}`}
                          strokeLinecap="round"
                          strokeOpacity="0.9"
                        />
                      </g>
                    )}

                    {/* Visual measurement markers & macro precision guides */}
                    {sideMarkers.map((marker: SiteMarker) => {
                      const isSelected = active === marker.field;
                      const isFocused = focusField === marker.field;
                      const isRequired = requiredSet.has(marker.field);
                      const strokeColor = isFocused
                        ? 'var(--ws-primary)'
                        : 'var(--ws-text-2)';
                      const pinY = bandCenterY(marker);

                      if (
                        marker.kind === 'perimeter' &&
                        marker.bandLeftX !== undefined &&
                        marker.bandRightX !== undefined
                      ) {
                        const d = bandCurvePath(
                          marker.bandLeftX,
                          marker.bandRightX,
                          marker.y,
                          marker.bandDip ?? 3
                        );
                        return (
                          <g key={marker.field}>
                            <path
                              d={d}
                              fill="none"
                              stroke="var(--ws-surface)"
                              strokeOpacity={isFocused ? 0.92 : 0.55}
                              strokeWidth={
                                (isFocused ? 4.4 : 2.6) * markerScale
                              }
                              strokeLinecap="round"
                            />
                            <path
                              d={d}
                              fill="none"
                              stroke={strokeColor}
                              strokeOpacity={isFocused ? 1 : 0.72}
                              strokeWidth={
                                (isFocused ? 2.4 : 1.4) * markerScale
                              }
                              strokeDasharray={
                                isFocused
                                  ? undefined
                                  : `${3.2 * markerScale} ${2.4 * markerScale}`
                              }
                              strokeLinecap="round"
                            />
                            {isFocused && (
                              <path
                                d={d}
                                fill="none"
                                stroke="var(--ws-on-primary)"
                                strokeOpacity="0.7"
                                strokeWidth={1.1 * markerScale}
                                strokeDasharray={`${0.8 * markerScale} ${4.2 * markerScale}`}
                                strokeLinecap="round"
                              />
                            )}
                            {isSelected && (
                              <circle
                                cx={marker.x}
                                cy={pinY}
                                r={9 * markerScale}
                                fill="var(--ws-primary)"
                                fillOpacity="0.18"
                                className="anatomical-pulse"
                              />
                            )}
                            <circle
                              cx={marker.x}
                              cy={pinY}
                              r={(isFocused ? 4.8 : 3.2) * markerScale}
                              fill={
                                isFocused
                                  ? 'var(--ws-primary)'
                                  : 'var(--ws-surface)'
                              }
                              stroke={strokeColor}
                              strokeWidth={1.7 * markerScale}
                            />
                          </g>
                        );
                      }

                      return (
                        <g key={marker.field}>
                          {(isSelected || isFocused) && (
                            <>
                              <circle
                                cx={marker.x}
                                cy={marker.y}
                                r={10.5 * markerScale}
                                fill="var(--ws-primary)"
                                fillOpacity="0.18"
                                className={
                                  isSelected ? 'anatomical-pulse' : undefined
                                }
                              />
                              <circle
                                cx={marker.x}
                                cy={marker.y}
                                r={11.5 * markerScale}
                                fill="none"
                                stroke="var(--ws-primary)"
                                strokeOpacity="0.65"
                                strokeWidth={1 * markerScale}
                                strokeDasharray={`${2.2 * markerScale} ${1.8 * markerScale}`}
                              />
                              {/* Precision focus reticle brackets */}
                              <path
                                d={`M ${fmtCoord(marker.x - 8 * markerScale)} ${fmtCoord(marker.y)} L ${fmtCoord(marker.x - 4.5 * markerScale)} ${fmtCoord(marker.y)} M ${fmtCoord(marker.x + 4.5 * markerScale)} ${fmtCoord(marker.y)} L ${fmtCoord(marker.x + 8 * markerScale)} ${fmtCoord(marker.y)} M ${fmtCoord(marker.x)} ${fmtCoord(marker.y - 8 * markerScale)} L ${fmtCoord(marker.x)} ${fmtCoord(marker.y - 4.5 * markerScale)} M ${fmtCoord(marker.x)} ${fmtCoord(marker.y + 4.5 * markerScale)} L ${fmtCoord(marker.x)} ${fmtCoord(marker.y + 8 * markerScale)}`}
                                fill="none"
                                stroke="var(--ws-primary-fg)"
                                strokeWidth={1.2 * markerScale}
                                strokeLinecap="round"
                              />
                            </>
                          )}
                          {isRequired && !isFocused && (
                            <circle
                              cx={marker.x}
                              cy={marker.y}
                              r={7.5 * markerScale}
                              fill="none"
                              stroke="var(--ws-primary)"
                              strokeWidth={1.3 * markerScale}
                              strokeDasharray={`${2.4 * markerScale} ${1.9 * markerScale}`}
                            />
                          )}
                          <circle
                            cx={marker.x}
                            cy={marker.y}
                            r={(isFocused ? 4.4 : 3.8) * markerScale}
                            fill={
                              isFocused
                                ? 'var(--ws-primary)'
                                : isRequired
                                  ? 'var(--ws-selected)'
                                  : 'var(--ws-surface)'
                            }
                            stroke={
                              isFocused || isRequired
                                ? 'var(--ws-primary)'
                                : 'var(--ws-text-2)'
                            }
                            strokeWidth={1.7 * markerScale}
                          />
                          {isFocused && (
                            <circle
                              cx={marker.x}
                              cy={marker.y}
                              r={1.6 * markerScale}
                              fill="var(--ws-on-primary)"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Native accessible button overlay matching exact SVG coordinates */}
                  {sideMarkers.map((marker) => {
                    const [label] = measurementFields[marker.field];
                    const pinY = bandCenterY(marker);
                    return (
                      <button
                        key={marker.field}
                        type="button"
                        aria-label={`${label} (${side === 'front' ? 'vista anterior' : 'vista posterior'})`}
                        aria-pressed={active === marker.field}
                        onClick={() => handleSelect(marker.field)}
                        onMouseEnter={() => setHovered(marker.field)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setFocusedPin(marker.field)}
                        onBlur={() => setFocusedPin(null)}
                        style={{
                          left: `${(marker.x / FIGURE_WIDTH) * 100}%`,
                          top: `${(pinY / FIGURE_HEIGHT) * 100}%`,
                        }}
                        className="ws-plain anatomical-pin absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ws-primary)"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleMarkers.map((marker) => {
          const [label] = measurementFields[marker.field];
          const isSelected = active === marker.field;
          const isRequired = requiredSet.has(marker.field);
          return (
            <button
              key={marker.field}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(marker.field)}
              onMouseEnter={() => setHovered(marker.field)}
              onMouseLeave={() => setHovered(null)}
              className="ws-btn anatomical-chip min-h-11 text-xs"
            >
              <span>{label}</span>
              {isRequired && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    isSelected
                      ? 'bg-(--ws-primary) text-(--ws-on-primary)'
                      : 'bg-(--ws-selected) text-(--ws-primary-fg)'
                  }`}
                >
                  Obligatorio
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-(--ws-border-subtle) bg-(--ws-surface-2) p-3 space-y-1.5">
        <p role="status" className="text-sm font-semibold">
          {active
            ? `${measurementFields[active][0]} (${measurementFields[active][1]})`
            : 'Enfoca una medición para acercar su zona anatómica.'}
          {active === 'abdomenUmbilicalCm'
            ? ' · Perímetro horizontal a nivel del ombligo; no sustituye cintura.'
            : ''}
        </p>
        {focusMarker ? (
          <div className="space-y-1 text-xs text-(--ws-text-2)">
            <p>
              <span className="font-semibold text-(--ws-text)">
                Musculatura (
                {focusMarker.side === 'front' ? 'Frente' : 'Espalda'}):
              </span>{' '}
              {focusMarker.muscleLabel}.
            </p>
            <p>
              <span className="font-semibold text-(--ws-text)">
                Referencia visual:
              </span>{' '}
              {focusMarker.visualGuide}
            </p>
            <p className="text-[11px] text-(--ws-muted)">
              Referencia orientativa sobre el diagrama; verifica el sitio exacto
              con el protocolo técnico aplicable.
            </p>
          </div>
        ) : (
          <p className="text-xs text-(--ws-text-2)">
            Al seleccionar un sitio o campo, el esquema se acerca al músculo
            correspondiente y muestra su referencia visual.
          </p>
        )}
      </div>
    </section>
  );
}

function fmtCoord(n: number): string {
  return Number(n.toFixed(1)).toString();
}
