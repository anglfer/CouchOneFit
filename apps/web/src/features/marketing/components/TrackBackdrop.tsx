import type { ReactElement } from 'react';

/**
 * Motivo gráfico de curvas de pista inspirado en `JourneySurface` de la app móvil.
 * Se mantiene sutil y con aria-hidden para no competir con texto ni marcos.
 */
export function TrackBackdrop({
  variant = 'brand',
  className = '',
}: {
  variant?: 'brand' | 'night';
  className?: string;
}): ReactElement {
  const toneClass =
    variant === 'night' ? 'text-indigo-300/15' : 'text-white/18';

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${toneClass} ${className}`}
    >
      <path
        d="M-80 490 C 220 420, 420 130, 820 140 C 1020 145, 1140 85, 1280 20"
        strokeWidth="1.5"
        className="mk-track-path"
      />
      <path
        d="M-60 545 C 260 470, 460 180, 850 190 C 1050 195, 1170 135, 1300 75"
        strokeWidth="1.25"
        className="mk-track-path mk-track-path-delay-1"
      />
      <path
        d="M-40 600 C 300 520, 500 230, 880 240 C 1080 245, 1200 185, 1320 130"
        strokeWidth="1"
        className="mk-track-path mk-track-path-delay-2"
      />
    </svg>
  );
}
