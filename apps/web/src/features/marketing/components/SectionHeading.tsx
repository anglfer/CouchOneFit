import type { ReactElement, ReactNode } from 'react';

/** Título de sección en la tipografía de señalética, con su texto de apoyo. */
export function SectionHeading({
  id,
  title,
  children,
  tone = 'ink',
  className = '',
}: {
  id: string;
  title: string;
  children?: ReactNode;
  /** `ink` sobre blanco o naranja; `white` sobre cobalto, rosa o negro. */
  tone?: 'ink' | 'white';
  className?: string;
}): ReactElement {
  const white = tone === 'white';
  return (
    <div className={`max-w-[44rem] ${className}`}>
      <h2
        id={id}
        className={`sg-display text-[clamp(1.85rem,3.6vw,3rem)] font-bold leading-[1.1] ${white ? 'text-white' : 'text-(--sg-ink)'}`}
      >
        {title}
      </h2>
      {children && (
        <p
          className={`mt-5 max-w-[38rem] text-lg leading-relaxed ${white ? 'text-white/90' : 'text-(--sg-ink-2)'}`}
        >
          {children}
        </p>
      )}
    </div>
  );
}
