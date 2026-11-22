import type { CSSProperties, ReactElement } from 'react';

/**
 * Capturas reales del producto (public/marketing), tomadas del panel y de la
 * app móvil con datos de demostración. Cada archivo lleva su procedencia en
 * `<nombre>.webp.json`.
 */
export type PanelScreen =
  | 'panel-inicio'
  | 'panel-expediente'
  | 'panel-entrenamiento'
  | 'panel-nutricion'
  | 'panel-seguimiento';
export type PhoneScreen =
  'movil-inicio' | 'movil-checkin' | 'movil-planes' | 'movil-progreso';

/** Recorte en % de la captura; se ajusta por breakpoint con `--crop-*`. */
const cropImage: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  maxWidth: 'none',
  width: 'calc(100% * 100 / var(--crop-w, 100))',
  transform:
    'translate(calc(var(--crop-x, 0) * -1%), calc(var(--crop-y, 0) * -1%))',
};

export function PanelImage({
  screen,
  alt,
  eager = false,
  className = '',
  style,
}: {
  screen: PanelScreen;
  alt: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}): ReactElement {
  return (
    <img
      src={`/marketing/${screen}.webp`}
      alt={alt}
      width={2160}
      height={1350}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      className={className}
      style={{ ...cropImage, ...style }}
    />
  );
}

/**
 * Ventana de navegador sobria alrededor de una captura del panel. El área
 * visible la fija `viewClassName` (aspect-ratio y variables `--crop-*`).
 */
export function BrowserFrame({
  label = 'Panel profesional',
  viewClassName = 'aspect-[16/10]',
  className = '',
  children,
}: {
  label?: string;
  viewClassName?: string;
  className?: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <div className={`mk-browser ${className}`}>
      <div className="mk-browser-bar" aria-hidden="true">
        <span className="mk-browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="mk-browser-label">{label}</span>
      </div>
      <div className={`relative overflow-hidden bg-white ${viewClassName}`}>
        {children}
      </div>
    </div>
  );
}

export function PanelShot({
  screen,
  alt,
  eager,
  label,
  viewClassName,
  className,
}: {
  screen: PanelScreen;
  alt: string;
  eager?: boolean;
  label?: string;
  viewClassName?: string;
  className?: string;
}): ReactElement {
  return (
    <BrowserFrame
      label={label}
      viewClassName={viewClassName}
      className={className}
    >
      <PanelImage screen={screen} alt={alt} eager={eager} />
    </BrowserFrame>
  );
}

/** Teléfono con bisel oscuro; el ancho lo define el contenedor. */
export function PhoneFrame({
  className = '',
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <div className={`mk-phone ${className}`} style={style}>
      <div className="relative aspect-[720/1600] overflow-hidden rounded-[inherit] bg-[#0d0b1a]">
        {children}
      </div>
    </div>
  );
}

export function PhoneImage({
  screen,
  alt,
  eager = false,
  className = '',
}: {
  screen: PhoneScreen;
  alt: string;
  eager?: boolean;
  className?: string;
}): ReactElement {
  return (
    <img
      src={`/marketing/${screen}.webp`}
      alt={alt}
      width={720}
      height={1600}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}

export function PhoneShot({
  screen,
  alt,
  eager,
  className,
}: {
  screen: PhoneScreen;
  alt: string;
  eager?: boolean;
  className?: string;
}): ReactElement {
  return (
    <PhoneFrame className={className}>
      <PhoneImage screen={screen} alt={alt} eager={eager} />
    </PhoneFrame>
  );
}
