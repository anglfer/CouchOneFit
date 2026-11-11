import { measurementFields, type MeasurementField } from '../types/assessment';
const locations: Partial<
  Record<MeasurementField, [number, number, 'front' | 'back']>
> = {
  neckCm: [80, 52, 'front'],
  waistCm: [80, 122, 'front'],
  abdomenUmbilicalCm: [80, 136, 'front'],
  hipCm: [80, 157, 'front'],
  pectoralSkinfoldMm: [65, 85, 'front'],
  abdominalSkinfoldMm: [90, 134, 'front'],
  thighSkinfoldMm: [64, 195, 'front'],
  tricepsSkinfoldMm: [39, 100, 'back'],
  bicepsSkinfoldMm: [42, 100, 'front'],
  subscapularSkinfoldMm: [65, 89, 'back'],
  suprailiacSkinfoldMm: [103, 137, 'front'],
};
export default function AnatomicalGuide({
  active,
  onSelect,
}: {
  active: MeasurementField | null;
  onSelect: (key: MeasurementField) => void;
}) {
  return (
    <section
      aria-label="Referencia anatómica"
      className="rounded-lg border border-(--ws-border) p-4 space-y-2"
    >
      <h3 className="font-semibold">Referencia anatómica</h3>
      <p className="text-sm text-(--ws-muted)">
        Esquema orientativo. Los puntos no sustituyen un protocolo técnico de
        medición. Navy y JP3 siguen deshabilitados.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(['front', 'back'] as const).map((side) => (
          <div key={side}>
            <p className="text-center text-sm">
              {side === 'front' ? 'Frente' : 'Espalda'}
            </p>
            <svg
              viewBox="0 0 160 270"
              className="mx-auto w-full max-w-48"
              role="group"
              aria-label={
                side === 'front' ? 'Vista anterior' : 'Vista posterior'
              }
            >
              <g
                fill="var(--ws-surface)"
                stroke="var(--ws-muted)"
                strokeWidth="2"
              >
                <circle cx="80" cy="28" r="18" />
                <path d="M69 46 L69 55 L48 65 L24 122 L35 128 L57 88 L57 147 L52 180 L53 253 L69 253 L80 181 L91 253 L107 253 L108 180 L103 147 L103 88 L125 128 L136 122 L112 65 L91 55 L91 46" />
              </g>
              {Object.entries(locations)
                .filter(([, v]) => v[2] === side)
                .map(([key, [x, y]]) => (
                  <g
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={measurementFields[key as MeasurementField][0]}
                    aria-pressed={active === key}
                    onClick={() => onSelect(key as MeasurementField)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(key as MeasurementField);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-(--ws-primary)"
                  >
                    <circle cx={x} cy={y} r="18" fill="transparent" />
                    <circle
                      cx={x}
                      cy={y}
                      r={active === key ? 8 : 5}
                      fill={
                        active === key ? 'var(--ws-primary)' : 'var(--ws-muted)'
                      }
                    />
                  </g>
                ))}
            </svg>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(locations).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={active === key}
            onClick={() => onSelect(key as MeasurementField)}
            className="ws-btn min-h-11 text-xs"
          >
            {measurementFields[key as MeasurementField][0]}
          </button>
        ))}
      </div>
      <p role="status" className="text-sm">
        {active
          ? `${measurementFields[active][0]} (${measurementFields[active][1]})`
          : 'Enfoca una medición para localizar su zona.'}
        {active === 'abdomenUmbilicalCm'
          ? ' · Perímetro horizontal a nivel del ombligo; no sustituye cintura.'
          : ''}
      </p>
    </section>
  );
}
