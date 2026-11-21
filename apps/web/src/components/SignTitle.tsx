import type { CSSProperties, ElementType, ReactElement } from 'react';

/**
 * Titular con contorno de líneas paralelas (signage.css). Las capas de anillos
 * son decorativas; lectores de pantalla y selección solo ven la capa de tinta.
 */
export function SignTitle({
  as: Tag = 'h1',
  id,
  lines,
  className = '',
  colors,
}: {
  as?: ElementType;
  id?: string;
  lines: string[];
  className?: string;
  colors?: { fill?: string; gap?: string; ringA?: string; ringB?: string };
}): ReactElement {
  const text = lines.map((line) => (
    <span key={line} className="block">
      {line}
    </span>
  ));
  const style = colors
    ? ({
        '--fill': colors.fill,
        '--gap': colors.gap,
        '--ring-a': colors.ringA,
        '--ring-b': colors.ringB,
      } as CSSProperties)
    : undefined;
  return (
    <Tag id={id} className={`sg-title ${className}`} style={style}>
      {(['4', '3', '2', '1'] as const).map((ring) => (
        <span key={ring} data-ring={ring} aria-hidden="true">
          {text}
        </span>
      ))}
      <span>{text}</span>
    </Tag>
  );
}
