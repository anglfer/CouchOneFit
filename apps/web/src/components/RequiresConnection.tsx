import { usePwa } from '../hooks/usePwa';

/**
 * Acciones que solo existen con conexión (docs/architecture/pwa-offline.md §2.2):
 * sin red se ven deshabilitadas con este texto, nunca ocultas.
 */
export default function RequiresConnection({ what }: { what?: string }) {
  if (usePwa().isOnline) return null;
  return (
    <p className="text-sm text-(--ws-muted)">
      Requiere conexión{what ? `: ${what}` : ''}.
    </p>
  );
}
