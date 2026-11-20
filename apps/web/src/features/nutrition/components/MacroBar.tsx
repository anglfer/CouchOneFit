import type { MacroSummary } from '../utils/foodCatalog';

interface MacroBarProps {
  caloriesTarget: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  planned?: MacroSummary | null;
  compact?: boolean;
  label?: string;
}

export default function MacroBar({
  caloriesTarget,
  proteinG,
  carbsG,
  fatG,
  planned,
  compact = false,
  label = 'Distribución de macronutrientes',
}: MacroBarProps) {
  const p = Math.max(0, proteinG ?? 0);
  const c = Math.max(0, carbsG ?? 0);
  const f = Math.max(0, fatG ?? 0);

  const pKcal = Math.round(p * 4);
  const cKcal = Math.round(c * 4);
  const fKcal = Math.round(f * 9);
  const macroKcal = pKcal + cKcal + fKcal;

  const hasTargets =
    caloriesTarget !== null ||
    proteinG !== null ||
    carbsG !== null ||
    fatG !== null;

  if (!hasTargets && (!planned || planned.itemsWithMacros === 0)) {
    return null;
  }

  const denom = macroKcal > 0 ? macroKcal : 1;
  const pPct = macroKcal > 0 ? Math.round((pKcal / denom) * 100) : 0;
  const cPct = macroKcal > 0 ? Math.round((cKcal / denom) * 100) : 0;
  const fPct = macroKcal > 0 ? Math.max(0, 100 - pPct - cPct) : 0;

  const tiles = [
    {
      key: 'protein',
      name: 'Proteína',
      grams: proteinG,
      kcal: pKcal,
      pct: pPct,
      plannedGrams: planned?.proteinG ?? null,
      toneClass: 'is-protein',
    },
    {
      key: 'carbs',
      name: 'Carbos',
      grams: carbsG,
      kcal: cKcal,
      pct: cPct,
      plannedGrams: planned?.carbsG ?? null,
      toneClass: 'is-carbs',
    },
    {
      key: 'fat',
      name: 'Grasas',
      grams: fatG,
      kcal: fKcal,
      pct: fPct,
      plannedGrams: planned?.fatG ?? null,
      toneClass: 'is-fat',
    },
  ];

  const displayCalories = caloriesTarget ?? (macroKcal > 0 ? macroKcal : null);
  const coveragePct =
    displayCalories &&
    displayCalories > 0 &&
    planned &&
    planned.itemsWithMacros > 0
      ? Math.round((planned.calories / displayCalories) * 100)
      : null;

  return (
    <div className={`nutrition-macro-box${compact ? ' is-compact' : ''}`}>
      <div className="nutrition-macro-head">
        <span className="nutrition-macro-title">{label}</span>
        <span className="nutrition-macro-meta">
          {displayCalories !== null
            ? `${displayCalories} kcal meta`
            : 'Sin kcal meta'}
          {macroKcal > 0 &&
            caloriesTarget !== null &&
            Math.abs(macroKcal - caloriesTarget) > 15 &&
            ` · suma macros ${macroKcal} kcal`}
        </span>
      </div>

      {macroKcal > 0 && (
        <div
          className="nutrition-macro-track"
          role="img"
          aria-label={`Distribución calórica: Proteína ${pPct}%, Carbohidratos ${cPct}%, Grasas ${fPct}%`}
        >
          <span
            className="nutrition-macro-seg is-protein"
            style={{ width: `${pPct}%` }}
          />
          <span
            className="nutrition-macro-seg is-carbs"
            style={{ width: `${cPct}%` }}
          />
          <span
            className="nutrition-macro-seg is-fat"
            style={{ width: `${fPct}%` }}
          />
        </div>
      )}

      <div className="nutrition-macro-cards">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className={`nutrition-macro-card ${tile.toneClass}`}
          >
            <div className="nutrition-macro-card-top">
              <span className="nutrition-macro-dot" aria-hidden="true" />
              <span>{tile.name}</span>
              {macroKcal > 0 && tile.grams !== null && (
                <strong className="nutrition-macro-pct">{tile.pct}%</strong>
              )}
            </div>
            <div className="nutrition-macro-card-val">
              <strong>
                {tile.grams !== null ? `${Math.round(tile.grams)} g` : '—'}
              </strong>
              {!compact && tile.grams !== null && (
                <small>{tile.kcal} kcal</small>
              )}
            </div>
            {planned &&
              planned.itemsWithMacros > 0 &&
              tile.plannedGrams !== null && (
                <div className="nutrition-macro-planned">
                  En comidas: {Math.round(tile.plannedGrams)} g
                </div>
              )}
          </div>
        ))}
      </div>

      {planned && planned.itemsWithMacros > 0 && (
        <div className="nutrition-coverage-strip">
          <span>
            Sumado en alimentos ({planned.itemsWithMacros}/{planned.totalItems}{' '}
            con referencia): <strong>{planned.calories} kcal</strong> · P{' '}
            {Math.round(planned.proteinG)} g · C {Math.round(planned.carbsG)} g
            · G {Math.round(planned.fatG)} g
          </span>
          {coveragePct !== null && (
            <span
              className="nutrition-coverage-pill"
              data-status={
                coveragePct >= 90 && coveragePct <= 110
                  ? 'ok'
                  : coveragePct > 110
                    ? 'high'
                    : 'low'
              }
            >
              {coveragePct}% de la meta
            </span>
          )}
        </div>
      )}
    </div>
  );
}
