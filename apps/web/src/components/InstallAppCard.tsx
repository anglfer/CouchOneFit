import { useState, type ReactElement } from 'react';
import { installApp, isAppleMobile } from '../services/pwa';
import { usePwa } from '../hooks/usePwa';
import { Icon } from './Icon';

/** Estado e instalación de la PWA del sistema interno. */
export default function InstallAppCard(): ReactElement {
  const { canInstall, isInstalled } = usePwa();
  const [dismissed, setDismissed] = useState(false);

  let body: ReactElement;
  if (isInstalled) {
    body = (
      <p className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
        <Icon name="check" size={16} />
        Estás usando CouchOne Fit como app instalada.
      </p>
    );
  } else if (canInstall) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Ábrela desde tu escritorio o pantalla de inicio, en su propia ventana
          y sin pestañas del navegador.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-xs cursor-pointer transition-all"
          onClick={async () => setDismissed(!(await installApp()))}
        >
          <Icon name="download" size={16} />
          Instalar app
        </button>
      </div>
    );
  } else if (isAppleMobile) {
    body = (
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        En Safari, toca{' '}
        <strong className="text-slate-900 dark:text-white font-semibold">
          Compartir
        </strong>{' '}
        y después{' '}
        <strong className="text-slate-900 dark:text-white font-semibold">
          Agregar a inicio
        </strong>
        .
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {dismissed
          ? 'Puedes instalarla más tarde desde el menú del navegador.'
          : 'Si tu navegador es compatible, busca «Instalar CouchOne Fit» en su menú o en la barra de direcciones.'}
      </p>
    );
  }

  return (
    <section
      className="p-6 rounded-2xl bg-white dark:bg-[#0c152c] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3"
      aria-labelledby="install-title"
    >
      <header className="flex items-center gap-3">
        <span
          className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Icon name="download" size={18} />
        </span>
        <div>
          <h2
            id="install-title"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            App de escritorio y móvil
          </h2>
        </div>
      </header>
      {body}
    </section>
  );
}
