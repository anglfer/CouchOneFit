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
  const keys = Object.keys(results);

  if (preliminary && keys.length === 0 && !note) {
    return (
      <section
        aria-label="Resultados preliminares"
        className="rounded-xl border border-(--ws-border) bg-(--ws-surface-2) px-4 py-3 text-sm"
      >
        <h3 className="font-semibold text-(--ws-text)">
          Cálculo en vivo · confirmar al guardar
        </h3>
        <p className="mt-1 text-(--ws-muted)">
          Captura medidas para previsualizar el % de grasa y relaciones
          corporales.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label={
        preliminary ? 'Resultados preliminares' : 'Resultados guardados'
      }
      className="space-y-3 rounded-xl border border-(--ws-border) bg-(--ws-surface-2) p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {preliminary
            ? 'Previsualización · confirmar al guardar'
            : 'Resultados guardados'}
        </h3>
        {!preliminary && fat > 0 && fat < 100 && (
          <span className="ws-badge" data-tone="ok">
            {fat.toFixed(1)}% grasa
          </span>
        )}
      </div>
      {note && (
        <p role="status" className="text-sm text-(--ws-muted)">
          {note}
        </p>
      )}
      {fat > 0 && fat < 100 && (
        <div className="flex flex-wrap items-center gap-4">
          <svg
            viewBox="0 0 120 120"
            width="104"
            height="104"
            role="img"
            aria-label={`Grasa ${fat.toFixed(1)} por ciento; resto libre de grasa ${(100 - fat).toFixed(1)} por ciento`}
          >
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--ws-border)"
              strokeWidth="15"
            />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--ws-primary)"
              strokeWidth="15"
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
              fontWeight="700"
            >
              {fat.toFixed(1)}%
            </text>
          </svg>
          <p className="min-w-0 flex-1 text-sm text-(--ws-text-2)">
            {estimated
              ? 'Estimado con Jackson–Pollock 3 pliegues + Siri y la edad a la fecha de medición.'
              : 'Grasa corporal y fracción libre de grasa. No representa masa muscular.'}
          </p>
        </div>
      )}
      {keys.length === 0 ? (
        !note && (
          <p className="text-sm text-(--ws-muted)">
            Sin resultados calculables con las entradas actuales.
          </p>
        )
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(results).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-(--ws-border) bg-(--ws-surface) px-3 py-2"
            >
              <dt className="text-xs text-(--ws-muted)">
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
