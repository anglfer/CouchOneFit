import type { ReactElement } from 'react';
import { LogoMark } from './LogoMark';

/** Pantalla o bloque de carga con el isotipo animado. */
export function LoadingScreen({
  label = 'Cargando…',
  fullscreen = false,
}: {
  label?: string;
  fullscreen?: boolean;
}): ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`grid place-items-center ${fullscreen ? 'min-h-svh' : 'min-h-64'}`}
    >
      <div className="flex flex-col items-center gap-5">
        <LogoMark size={72} animated />
        <p className="text-sm font-medium text-(--ws-muted,#626a90)">{label}</p>
      </div>
    </div>
  );
}
