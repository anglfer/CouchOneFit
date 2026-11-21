const labels: Record<string, string> = {
  bodyFatPercentage: 'Grasa corporal informada (%)',
  fatMassKg: 'Masa grasa (kg)',
  fatFreeMassKg: 'Masa libre de grasa (kg)',
  waistHipRatio: 'ICC · cintura/cadera',
  waistHeightRatio: 'ICE · cintura/estatura',
  approximateWaterPercentage: 'Agua aproximada (%)',
  sumSkinfoldMm: 'Suma de 3 pliegues (mm)',
  bodyDensityGPerMl: 'Densidad corporal (g/mL)',
};
export default function CompositionResults({
  results,
  method,
  note,
  preliminary = false,
}: {
  results: Record<string, number>;
  method?: string;
  note?: string | null;
  preliminary?: boolean;
}) {
  const fat = results.bodyFatPercentage;
  const estimated = method === 'pliegues';
  return (
    <section
      aria-label={
        preliminary ? 'Resultados preliminares' : 'Resultados guardados'
      }
      className="rounded-lg border border-(--ws-border) p-4 space-y-3"
    >
      <h3 className="font-semibold">
        {preliminary
          ? 'Previsualización · confirmar al guardar'
          : 'Resultados guardados'}
      </h3>
      {note && (
        <p role="status" className="text-sm text-(--ws-muted)">
          {note}
        </p>
      )}
      {fat > 0 && fat < 100 && (
        <div className="flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 120 120"
            width="120"
            height="120"
            role="img"
            aria-label={`Grasa ${fat.toFixed(1)} por ciento; resto libre de grasa ${(100 - fat).toFixed(1)} por ciento`}
          >
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--ws-border)"
              strokeWidth="16"
            />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--ws-primary)"
              strokeWidth="16"
              pathLength="100"
              strokeDasharray={`${fat} ${100 - fat}`}
              transform="rotate(-90 60 60)"
            />
            <text
              x="60"
              y="65"
              textAnchor="middle"
              fill="currentColor"
              fontSize="18"
            >
              {fat.toFixed(1)}%
            </text>
          </svg>
          <p className="text-sm">
            {estimated
              ? 'Estimado con Jackson–Pollock 3 pliegues + Siri y la edad a la fecha de medición.'
              : 'Grasa corporal y fracción libre de grasa. No representa masa muscular.'}
          </p>
        </div>
      )}
      {!Object.keys(results).length ? (
        !note && (
          <p className="text-sm text-(--ws-muted)">
            Sin resultados calculables con las entradas actuales.
          </p>
        )
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(results).map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-(--ws-muted)">
                {estimated && key === 'bodyFatPercentage'
                  ? 'Grasa corporal estimada (%)'
                  : (labels[key] ?? key)}
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {value.toFixed(
                  key === 'bodyDensityGPerMl'
                    ? 4
                    : key.includes('Ratio')
                      ? 3
                      : 1
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-(--ws-muted)">
        Sin clasificación clínica. Agua: aproximación de 1 L ≈ 1 kg. Las vistas
        redondean; el registro conserva la precisión de cálculo.
      </p>
    </section>
  );
}
