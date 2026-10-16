import type { ReactElement } from 'react';
import {
  useThemePreference,
  type ThemePreference,
} from '../../../shared/theme';
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
      className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5"
      aria-labelledby="appearance-title"
      aria-describedby="appearance-help"
    >
      <header>
        <h2 id="appearance-title" className="text-base font-bold text-slate-900 dark:text-white">
          Apariencia
        </h2>
        <p id="appearance-help" className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Elige cómo se ve tu panel. Se guarda en este dispositivo; el sitio
          público siempre se muestra en claro.
        </p>
      </header>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-none p-0 m-0">
        <legend className="sr-only">Tema del panel</legend>
        {options.map((option) => {
          const isSelected = preference === option.value;
          const previewTheme =
            option.value === 'system' ? resolvedTheme : option.value;
          const isDarkPreview = previewTheme === 'dark';

          return (
            <label
              key={option.value}
              className={`relative flex flex-col p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
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

              {/* Mini mockup ilustrativo del tema */}
              <div
                className={`h-12 w-full rounded-lg mb-3 flex overflow-hidden border ${
                  isDarkPreview
                    ? 'bg-[#050a1a] border-slate-800'
                    : 'bg-[#f8f9fd] border-slate-200'
                }`}
                aria-hidden="true"
              >
                <div
                  className={`w-6 shrink-0 border-r ${
                    isDarkPreview
                      ? 'bg-[#081126] border-slate-800/80'
                      : 'bg-white border-slate-200/80'
                  }`}
                />
                <div className="flex-1 p-1.5 space-y-1">
                  <div
                    className={`h-1.5 w-1/2 rounded-full ${
                      isDarkPreview ? 'bg-indigo-400/40' : 'bg-indigo-600/30'
                    }`}
                  />
                  <div
                    className={`h-2.5 w-full rounded ${
                      isDarkPreview ? 'bg-slate-800/80' : 'bg-white shadow-2xs'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white mb-1">
                <span className="flex items-center gap-1.5">
                  <Icon name={option.icon} size={15} />
                  {option.label}
                </span>
                {isSelected && (
                  <span className="text-indigo-600 dark:text-indigo-400">
                    <Icon name="check" size={15} />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {option.description}
              </p>
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}

