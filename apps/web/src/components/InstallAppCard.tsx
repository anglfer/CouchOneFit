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
      <p className="ws-alert flex items-center gap-2" data-tone="ok">
        <Icon name="check" size={16} />
        Estás usando CouchOne Fit como app instalada.
      </p>
    );
  } else if (canInstall) {
    body = (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-(--ws-text-2)">
          Ábrela desde tu escritorio o pantalla de inicio, en su propia ventana
          y sin pestañas del navegador.
        </p>
        <button
          type="button"
          className="ws-btn"
          data-variant="primary"
          onClick={async () => setDismissed(!(await installApp()))}
        >
          <Icon name="download" size={16} />
          Instalar app
        </button>
      </div>
    );
  } else if (isAppleMobile) {
    body = (
      <p className="text-sm leading-relaxed text-(--ws-text-2)">
        En Safari, toca{' '}
        <strong className="font-semibold text-(--ws-text)">Compartir</strong> y
        después{' '}
        <strong className="font-semibold text-(--ws-text)">
          Agregar a inicio
        </strong>
        .
      </p>
    );
  } else {
    body = (
      <p className="text-sm leading-relaxed text-(--ws-muted)">
        {dismissed
          ? 'Puedes instalarla más tarde desde el menú del navegador.'
          : 'Si tu navegador es compatible, busca «Instalar CouchOne Fit» en su menú o en la barra de direcciones.'}
      </p>
    );
  }

  return (
    <section className="ws-card space-y-3" aria-labelledby="install-title">
      <header className="flex items-center gap-3">
        <span className="ws-icon-tile" aria-hidden="true">
          <Icon name="download" size={18} />
        </span>
        <h2 id="install-title" className="ws-card-title">
          App de escritorio y móvil
        </h2>
      </header>
      {body}
    </section>
  );
}
