import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../components/Icon';

/** Cada módulo es una disciplina con pictograma y color propios en toda la landing. */
export type ModuleId =
  'evaluacion' | 'alimentacion' | 'entrenamiento' | 'seguimiento';

/** `onColor`: tinta legible sobre el color (negro en naranja y verde, blanco en cobalto y rosa). */
export const MODULES: Record<
  ModuleId,
  { label: string; icon: IconName; color: string; onColor: string }
> = {
  evaluacion: {
    label: 'Evaluación',
    icon: 'clipboard',
    color: 'var(--sg-orange)',
    onColor: 'var(--sg-ink)',
  },
  alimentacion: {
    label: 'Alimentación',
    icon: 'bowl',
    color: 'var(--sg-green)',
    onColor: 'var(--sg-ink)',
  },
  entrenamiento: {
    label: 'Entrenamiento',
    icon: 'dumbbell',
    color: 'var(--sg-cobalt)',
    onColor: '#ffffff',
  },
  seguimiento: {
    label: 'Seguimiento',
    icon: 'chart',
    color: 'var(--sg-pink)',
    onColor: '#ffffff',
  },
};

/**
 * Pictograma de módulo. `outlined` añade filo blanco para campos de color ajenos;
 * `onField` lo dibuja sobre su propio color (pestaña activa) con la tinta legible.
 */
export function ModuleChip({
  id,
  size = 40,
  outlined = false,
  onField = false,
}: {
  id: ModuleId;
  size?: number;
  outlined?: boolean;
  onField?: boolean;
}): ReactElement {
  const module = MODULES[id];
  const edge = onField ? module.onColor : outlined ? '#ffffff' : null;
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        color: onField ? module.onColor : '#ffffff',
        background: onField ? 'transparent' : module.color,
        boxShadow: edge ? `inset 0 0 0 2px ${edge}` : undefined,
      }}
      aria-hidden="true"
    >
      <Icon
        name={module.icon}
        size={Math.round(size * 0.55)}
        strokeWidth={2.2}
      />
    </span>
  );
}
