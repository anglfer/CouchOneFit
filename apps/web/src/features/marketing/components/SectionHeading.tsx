import type { ReactElement, ReactNode } from 'react';

/** Encabezado de sección: sección en mayúsculas, título y descripción. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  align = 'left',
  tone = 'light',
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
}): ReactElement {
  const dark = tone === 'dark';
  return (
    <div
      className={`mb-12 max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}
    >
      <p
        className={`mb-3 text-sm font-semibold uppercase tracking-wider ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`text-3xl font-bold leading-tight tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-slate-900'}`}
      >
        {title}
      </h2>
      {children && (
        <p
          className={`mt-4 text-lg leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-600'}`}
        >
          {children}
        </p>
      )}
    </div>
  );
}
