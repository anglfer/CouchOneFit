import type { ReactElement } from 'react';
import { type ThemePreference } from '../services/theme';
import { useThemePreference } from '../hooks/useThemePreference';
import { Icon, type IconName } from './Icon';

const options: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: IconName;
}[] = [
  {
    value: 'light',
    label: 'Claro',
    description: 'Fondos claros en todo el panel.',
    icon: 'sun',
  },
  {
    value: 'dark',
    label: 'Oscuro',
    description: 'Azul nocturno, cómodo con poca luz.',
    icon: 'moon',
  },
  {
    value: 'system',
    label: 'Sistema',
    description: 'Sigue la configuración de tu dispositivo.',
    icon: 'monitor',
  },
];

/** Preferencia de apariencia del sistema interno (perfil profesional/admin). */
export default function AppearanceSettings(): ReactElement {
  const { preference, resolvedTheme, setPreference } = useThemePreference();

  return (
    <section
      className="ws-card"
      aria-labelledby="appearance-title"
      aria-describedby="appearance-help"
    >
      <header className="mb-4">
        <h2 id="appearance-title" className="ws-card-title">
          Apariencia
        </h2>
        <p id="appearance-help" className="ws-card-sub">
          Elige cómo se ve tu panel. Se guarda en este dispositivo; el sitio
          público siempre se muestra en claro.
        </p>
      </header>

      <fieldset className="m-0 grid grid-cols-1 gap-3 border-0! bg-transparent! p-0! sm:grid-cols-3">
        <legend className="sr-only">Tema del panel</legend>
        {options.map((option) => {
          const isSelected = preference === option.value;
          const previewTheme =
            option.value === 'system' ? resolvedTheme : option.value;
          const isDarkPreview = previewTheme === 'dark';

          return (
            <label
              key={option.value}
              className={`relative flex cursor-pointer select-none flex-col rounded-lg border p-3 transition-colors ${
                isSelected
                  ? 'border-(--ws-primary) bg-(--ws-selected) ring-1 ring-(--ws-primary)'
                  : 'border-(--ws-border) bg-(--ws-surface-2) hover:border-(--ws-primary)'
              }`}
            >
              <input
                type="radio"
                name="theme-preference"
                value={option.value}
                checked={isSelected}
                onChange={() => setPreference(option.value)}
                className="sr-only"
              />
              <div
                className={`mb-3 flex h-12 w-full overflow-hidden rounded-md border ${
                  isDarkPreview
                    ? 'border-[#21305b] bg-[#050a1a]'
                    : 'border-[#d9dff6] bg-[#eef1fc]'
                }`}
                aria-hidden="true"
              >
                <div
                  className={`w-6 shrink-0 border-r ${
                    isDarkPreview
                      ? 'border-[#21305b] bg-[#081126]'
                      : 'border-[#d9dff6] bg-white'
                  }`}
                />
                <div className="flex-1 space-y-1 p-1.5">
                  <div
                    className={`h-1.5 w-1/2 rounded-full ${
                      isDarkPreview ? 'bg-[#6f67ff]/50' : 'bg-[#4037f7]/40'
                    }`}
                  />
                  <div
                    className={`h-2.5 w-full rounded ${
                      isDarkPreview ? 'bg-[#121f43]' : 'bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className="mb-1 flex items-center justify-between text-xs font-bold text-(--ws-text)">
                <span className="flex items-center gap-1.5">
                  <Icon name={option.icon} size={15} />
                  {option.label}
                </span>
                {isSelected && (
                  <span className="text-(--ws-primary-fg)">
                    <Icon name="check" size={15} />
                  </span>
                )}
              </div>
              <p className="text-[11.5px] leading-snug text-(--ws-muted)">
                {option.description}
              </p>
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}
