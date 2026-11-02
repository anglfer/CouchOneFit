import { useState } from 'react';

// Predefined goals are stored as their label in `goal` (free text in API/BD), so
// existing free-text records and the search by goal keep working unchanged.
const GOAL_OPTIONS = [
  'Recomposición corporal',
  'Definición',
  'Ganar masa muscular',
] as const;
const OTHER = '__other__';

export default function GoalField({
  value,
  onChange,
  disabled,
  error,
  errorId,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  errorId: string;
  className: string;
}) {
  const [otherChosen, setOtherChosen] = useState(false);
  const isOption = (GOAL_OPTIONS as readonly string[]).includes(value);
  const isOther = !isOption && (otherChosen || value !== '');
  return (
    <div className="space-y-2">
      <label className="block">
        Objetivo (opcional)
        <select
          className={className}
          disabled={disabled}
          value={isOption ? value : isOther ? OTHER : ''}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const next = event.target.value;
            setOtherChosen(next === OTHER);
            onChange(next === OTHER ? '' : next);
          }}
        >
          <option value="">Sin objetivo definido</option>
          {GOAL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={OTHER}>Otro</option>
        </select>
      </label>
      {isOther && (
        <label className="block">
          Especifica el objetivo
          <input
            className={className}
            maxLength={500}
            required
            disabled={disabled}
            value={value}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )}
      {error && (
        <p id={errorId} className="text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
