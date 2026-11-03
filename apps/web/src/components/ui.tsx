import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Encabezado de página del panel: sección, título, descripción y acciones. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}): ReactElement {
  return (
    <header className="ws-page-header">
      <div>
        {eyebrow && <span className="ws-eyebrow">{eyebrow}</span>}
        <h1 className="ws-title">{title}</h1>
        {lead && <p className="ws-lead">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

/** Etiqueta de estado. Siempre lleva texto: el color no es el único canal. */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}): ReactElement {
  return (
    <span className="ws-badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** Tarjeta con título opcional, icono y acción en la cabecera. */
export function Card({
  title,
  subtitle,
  icon,
  action,
  labelId,
  className = '',
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  action?: ReactNode;
  labelId?: string;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={`ws-card ${className}`} aria-labelledby={labelId}>
      {title && (
        <div className="ws-card-head">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="ws-icon-tile" aria-hidden="true">
                <Icon name={icon} size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={labelId} className="ws-card-title">
                {title}
              </h2>
              {subtitle && <p className="ws-card-sub">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Medidor de uso (clientes activos frente al límite del plan). */
export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}): ReactElement {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="ws-meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
