import { confirmDialog } from '../confirm';
import { discardAllOperations, getOperations } from './outbox';
import { flushOutbox } from './sync';

/**
 * Antes de cerrar sesión: si hay cambios sin enviar, se intenta enviarlos; si no se
 * puede, se avisa y solo se descartan si la persona lo confirma (nunca en silencio).
 */
export async function confirmLeaveWithPending(): Promise<boolean> {
  if (getOperations().length === 0) return true;
  if (navigator.onLine !== false) await flushOutbox();
  const left = getOperations().length;
  if (left === 0) return true;
  const confirmed = await confirmDialog({
    title: '¿Cerrar sesión y descartar cambios?',
    message: `Tienes ${left} ${left === 1 ? 'cambio' : 'cambios'} sin enviar. Si cierras sesión ahora se perderán.`,
    confirmLabel: 'Cerrar sesión y descartar',
    cancelLabel: 'Seguir conectado',
    danger: true,
  });
  if (!confirmed) return false;
  await discardAllOperations();
  return true;
}
