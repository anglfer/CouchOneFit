import { useId, type ReactElement } from 'react';

const C_PATH =
  'M740 262H535C400 262 295 380 295 512C295 640 395 742 520 742H630Q645 742 655 732L746 635Q752 626 740 618H535C475 618 432 570 432 512C432 455 475 400 535 400H612Q622 400 630 392L746 280Q752 264 740 262Z';
const ONE_PATH =
  'M840 243H930Q948 243 948 262V655Q948 695 910 712L828 757Q806 762 806 740V410Q806 400 796 400H690Q676 396 686 385L825 250Q832 243 840 243Z';

type Variant = 'color' | 'white' | 'ink';

/** Isotipo C1 en vectorial. `color` es el original; `white` y `ink` son de un solo color. */
export function LogoMark({
  size = 32,
  variant = 'color',
  animated = false,
  title,
  className,
}: {
  size?: number;
  variant?: Variant;
  /** Desliza la C y el 1 de forma suave (pantallas de carga). */
  animated?: boolean;
  title?: string;
  className?: string;
}): ReactElement {
  const uid = useId().replace(/:/g, '');
  const flat = variant === 'white' ? '#ffffff' : '#0b0b2b';
  return (
    <svg
      viewBox="280 230 680 540"
      width={size}
      height={(size * 540) / 680}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {variant === 'color' && (
        <defs>
          <linearGradient
            id={`${uid}c`}
            gradientUnits="userSpaceOnUse"
            x1="640"
            y1="262"
            x2="560"
            y2="745"
          >
            <stop offset="0" stopColor="#6e48ff" />
            <stop offset="0.45" stopColor="#1a1a58" />
            <stop offset="1" stopColor="#2f50ff" />
          </linearGradient>
          <linearGradient
            id={`${uid}s`}
            gradientUnits="userSpaceOnUse"
            x1="880"
            y1="300"
            x2="880"
            y2="760"
          >
            <stop offset="0" stopColor="#7a4dff" />
            <stop offset="1" stopColor="#1a3cff" />
          </linearGradient>
          <clipPath id={`${uid}o`}>
            <path d={ONE_PATH} />
          </clipPath>
        </defs>
      )}
      <path
        d={C_PATH}
        fill={variant === 'color' ? `url(#${uid}c)` : flat}
        className={animated ? 'logo-slide-c' : undefined}
      />
      {variant === 'color' ? (
        <g
          clipPath={`url(#${uid}o)`}
          className={animated ? 'logo-slide-o' : undefined}
        >
          <rect
            x="680"
            y="230"
            width="290"
            height="540"
            fill={`url(#${uid}s)`}
          />
          <path fill="#14143f" d="M670 403 840 225H960V292L806 446V403Z" />
        </g>
      ) : (
        <path
          d={ONE_PATH}
          fill={flat}
          className={animated ? 'logo-slide-o' : undefined}
        />
      )}
    </svg>
  );
}
