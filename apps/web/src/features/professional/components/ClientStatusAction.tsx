import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../services/api';
import {
  sessionMutationOnce,
  sessionRequest,
} from '../../auth/services/session';
import type { ClientBaseRecord } from '../types/portfolio';

export default function ClientStatusAction({
  clientId,
  status,
  accountId,
  disabled = false,
  onChanged,
  onBusyChange,
  sessionReady,
}: {
  clientId: string;
  status: string;
  accountId: string;
  disabled?: boolean;
  onChanged: (client: ClientBaseRecord) => void;
  onBusyChange?: (busy: boolean) => void;
  sessionReady: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ClientBaseRecord | null>(null);
  const [desired, setDesired] = useState<'active' | 'inactive' | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const sending = useRef(false);
  const notify = useRef(onBusyChange);
  useEffect(() => {
    notify.current = onBusyChange;
  }, [onBusyChange]);
  const url = `/api/clients/${encodeURIComponent(clientId)}`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      notify.current?.(false);
    };
  }, []);
  useEffect(() => {
    if (!sessionReady) {
      dialog.current?.close();
      return;
    }
    if (snapshot && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      cancel.current?.focus();
    }
  }, [snapshot, sessionReady]);
  function close() {
    if (sending.current) return;
    dialog.current?.close();
    setSnapshot(null);
    setDesired(null);
    setError('');
    setBlocked(false);
    notify.current?.(false);
  }
  async function load() {
    if (sending.current || !sessionReady) return;
    sending.current = true;
    setPending(true);
    setError('');
    notify.current?.(true);
    try {
      const result = await sessionRequest<{ client: ClientBaseRecord }>(url);
      if (mounted.current) {
        setSnapshot(result.client);
        if (!snapshot) setDesired(status === 'active' ? 'inactive' : 'active');
        setBlocked(false);
      }
    } catch {
      if (mounted.current) {
        setError(
          'No pudimos consultar el estado actual. No se envió otra solicitud de cambio.'
        );
        if (!snapshot) notify.current?.(false);
      }
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function confirm() {
    if (!sessionReady) return;
    if (
      sending.current ||
      blocked ||
      !snapshot ||
      !desired ||
      snapshot.status === desired
    )
      return;
    sending.current = true;
    setPending(true);
    setError('');
    const target = desired;
    try {
      const result = await sessionMutationOnce<{ client: ClientBaseRecord }>(
        `${url}/status`,
        { status: target, version: snapshot.version },
        'PATCH',
        accountId
      );
      if (mounted.current) {
        dialog.current?.close();
        setSnapshot(null);
        setDesired(null);
        notify.current?.(false);
        onChanged(result.client);
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof ApiError && failure.status < 500) {
        setError(failure.message);
        if (failure.code === 'CLIENT_RECORD_CONFLICT') setBlocked(true);
      } else {
        setBlocked(true);
        setError(
          'No podemos confirmar si cambió el estado. Consulta el estado actual antes de decidir; no se reenviará automáticamente.'
        );
      }
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled || pending || !!snapshot}
        onClick={() => void load()}
        className="px-4 py-2 border rounded-lg"
      >
        {pending && !snapshot
          ? 'Consultando estado…'
          : status === 'active'
            ? 'Inactivar expediente'
            : 'Reactivar expediente'}
      </button>
      {!snapshot && error && <p role="alert">{error}</p>}
      {snapshot && (
        <dialog
          ref={dialog}
          aria-labelledby={`status-title-${clientId}`}
          aria-describedby={`status-description-${clientId}`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          className="rounded-xl p-6 space-y-4 max-w-lg"
        >
          <h2 id={`status-title-${clientId}`}>
            {desired === 'inactive'
              ? 'Confirmar inactivación del expediente'
              : 'Confirmar reactivación del expediente'}
          </h2>
          <p>{snapshot.fullName}</p>
          <p id={`status-description-${clientId}`}>
            Se cambia únicamente el estado del expediente. Se conservan sus
            datos y relaciones. No se da de baja la cuenta, no se cierran sus
            sesiones ni se modifica la suscripción.
            {desired === 'inactive'
              ? ' Se libera su plaza activa; la cuenta activa conserva su lectura autorizada y no puede realizar operaciones de seguimiento mientras el expediente esté inactivo. Las invitaciones se conservan, pero no pueden canjearse mientras esté inactivo.'
              : ' Se requiere una suscripción vigente y una plaza disponible. No se reactiva una cuenta dada de baja ni se recuperan sesiones revocadas.'}
          </p>
          <p>
            Estado consultado:{' '}
            {snapshot.status === 'active' ? 'Activo' : 'Inactivo'}.
          </p>
          {error && <p role="alert">{error}</p>}
          <button ref={cancel} type="button" disabled={pending} onClick={close}>
            Cancelar cambio de estado
          </button>
          {snapshot.status === desired ? (
            <>
              <p role="status">
                El estado solicitado ya está aplicado. No hace falta reenviarlo.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  dialog.current?.close();
                  setSnapshot(null);
                  setDesired(null);
                  notify.current?.(false);
                  onChanged(snapshot);
                }}
              >
                Actualizar vistas con este estado
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending || blocked}
              onClick={() => void confirm()}
            >
              {pending
                ? 'Procesando…'
                : desired === 'inactive'
                  ? 'Confirmar inactivación'
                  : 'Confirmar reactivación'}
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => void load()}>
            Consultar estado actual
          </button>
        </dialog>
      )}
    </>
  );
}
