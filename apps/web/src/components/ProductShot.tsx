import type { CSSProperties, ReactElement } from 'react';

/**
 * Capturas reales del producto (public/marketing), tomadas del panel y de la app
 * con datos de demostración. `alt` describe lo que muestra la pantalla.
 */
export type PanelScreen =
  | 'panel-inicio'
  | 'panel-expediente'
  | 'panel-seguimiento'
  | 'panel-entrenamiento'
  | 'panel-nutricion';
export type PhoneScreen =
  'movil-inicio' | 'movil-checkin' | 'movil-progreso' | 'movil-planes';

type Rings = { ring1?: string; ring2?: string; ring3?: string; gap?: string };

function ringStyle(rings?: Rings): CSSProperties | undefined {
  if (!rings) return undefined;
  return {
    '--ring-1': rings.ring1,
    '--ring-2': rings.ring2,
    '--ring-3': rings.ring3,
    '--ring-gap': rings.gap,
  } as CSSProperties;
}

export function PanelShot({
  screen,
  alt,
  rings,
  eager = false,
  className = '',
}: {
  screen: PanelScreen;
  alt: string;
  rings?: Rings | false;
  eager?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={`overflow-hidden bg-white ${rings === false ? '' : 'sg-rings'} ${className}`}
      style={rings ? ringStyle(rings) : undefined}
    >
      <img
        src={`/marketing/${screen}.webp`}
        alt={alt}
        width={2160}
        height={1350}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover object-[45%_0%] md:object-left-top"
      />
    </div>
  );
}

export function PhoneShot({
  screen,
  alt,
  rings,
  eager = false,
  className = '',
}: {
  screen: PhoneScreen;
  alt: string;
  rings?: Rings;
  eager?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={`sg-phone ${rings ? 'sg-rings' : ''} ${className}`}
      style={ringStyle(rings)}
    >
      <img
        src={`/marketing/${screen}.webp`}
        alt={alt}
        width={720}
        height={1600}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}
