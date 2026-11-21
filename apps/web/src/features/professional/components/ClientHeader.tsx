import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { initials } from '../../../utils/personName';
import '../../training/training.css';

export type ClientTab =
  'summary' | 'training' | 'evaluation' | 'nutrition' | 'followUp';

export default function ClientHeader({
  clientId,
  name,
  active,
  badges,
  facts,
  actions,
}: {
  clientId: string;
  name: string;
  active: ClientTab;
  badges?: ReactNode;
  facts?: string[];
  actions?: ReactNode;
}): ReactElement {
  const tabs: [
    ClientTab,
    string,
    string,
    'home' | 'dumbbell' | 'clipboard' | 'bowl' | 'chart',
  ][] = [
    ['summary', 'Resumen', `/app/clientes/${clientId}`, 'home'],
    [
      'training',
      'Entrenamiento',
      `/app/clientes/${clientId}/entrenamiento`,
      'dumbbell',
    ],
    [
      'evaluation',
      'Evaluación',
      `/app/clientes/${clientId}/evaluacion`,
      'clipboard',
    ],
    ['nutrition', 'Nutrición', `/app/clientes/${clientId}/nutricion`, 'bowl'],
    [
      'followUp',
      'Seguimiento',
      `/app/clientes/${clientId}/seguimiento`,
      'chart',
    ],
  ];
  return (
    <header className="client-hub-header">
      <Link to="/app/clientes" className="client-hub-back">
        <Icon name="arrow-right" size={16} className="rotate-180" />
        Clientes
      </Link>
      <div className="client-hub-identity">
        <span className="ws-avatar ws-avatar-lg" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="client-hub-name">
          <h1 className="ws-title">{name}</h1>
          {badges && <div className="client-hub-badges">{badges}</div>}
          {facts && facts.length > 0 && (
            <p className="client-hub-facts">{facts.join(' · ')}</p>
          )}
        </div>
        {actions && <div className="client-hub-actions">{actions}</div>}
      </div>
      <nav className="training-tabs" aria-label="Secciones del cliente">
        {tabs.map(([key, label, href, icon]) => (
          <Link
            key={key}
            to={href}
            preventScrollReset
            aria-current={active === key ? 'page' : undefined}
          >
            <Icon name={icon} size={16} /> {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
