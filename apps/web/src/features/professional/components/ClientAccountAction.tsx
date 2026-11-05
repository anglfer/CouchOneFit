import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../services/api';
import { sessionMutationOnce } from '../../auth/services/session';

type AccountStatus = 'active' | 'inactive';

export default function ClientAccountAction({
  clientId,
  fullName,
  accountStatus,
  accountId,
  disabled = false,
  sessionReady,
  onBusyChange,
  onChanged,
}: {
  clientId: string;
  fullName: string;
  accountStatus: AccountStatus;
  accountId: string;
  disabled?: boolean;
  sessionReady: boolean;
  onBusyChange?: (busy: boolean) => void;
  onChanged: (status: AccountStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const sending = useRef(false);
  const notify = useRef(onBusyChange);
  useEffect(() => {
    notify.current = onBusyChange;
  }, [onBusyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      notify.current?.(false);
    };
  }, []);
  useEffect(() => {
    if (!sessionReady) dialog.current?.close();
    else if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      cancel.current?.focus();
    }
  }, [open, sessionReady]);
  const target: AccountStatus =
    accountStatus === 'active' ? 'inactive' : 'active';
  function close() {
    if (sending.current) return;
    dialog.current?.close();
    setOpen(false);
    setError('');
    notify.current?.(false);
  }
  async function confirm() {
    if (sending.current || !sessionReady) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      await sessionMutationOnce(
        `/api/clients/${encodeURIComponent(clientId)}/account`,
        { status: target },
        'PATCH',
        accountId
      );
      if (mounted.current) {
        dialog.current?.close();
        setOpen(false);
        notify.current?.(false);
        onChanged(target);
      }
    } catch (failure) {
      if (!mounted.current) return;
      // The operation is idempotent: after an uncertain outcome it is safe to confirm again.
      setError(
        failure instanceof ApiError && failure.status < 500
          ? failure.message
          : 'No podemos confirmar si cambió la cuenta. Puedes confirmar de nuevo: repetir la operación no duplica efectos.'
      );
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled || pending || open}
        onClick={() => {
          setOpen(true);
          notify.current?.(true);
        }}
        className="ws-btn"
        data-variant={accountStatus === 'active' ? 'danger' : undefined}
      >
        {accountStatus === 'active'
          ? 'Dar de baja la cuenta'
          : 'Reactivar cuenta'}
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby={`account-title-${clientId}`}
          aria-describedby={`account-description-${clientId}`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          className="m-auto rounded-xl p-6 space-y-4 max-w-lg border bg-white text-slate-900 dark:bg-[#0c152c] dark:text-white backdrop:bg-black/60"
        >
          <h2 id={`account-title-${clientId}`} className="text-lg font-bold">
            {target === 'inactive'
              ? 'Confirmar baja de la cuenta'
              : 'Confirmar reactivación de la cuenta'}
          </h2>
          <p>{fullName}</p>
          <p id={`account-description-${clientId}`}>
            {target === 'inactive'
              ? 'La persona no podrá iniciar sesión y se cerrarán sus sesiones abiertas. El expediente, su historial, su plaza y la suscripción no cambian. Puedes reactivar la cuenta después.'
              : 'La persona podrá volver a iniciar sesión. No se recuperan las sesiones cerradas y el expediente no se reactiva automáticamente: su estado y su plaza se administran aparte.'}
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            ref={cancel}
            type="button"
            disabled={pending}
            onClick={close}
            className="mr-2 px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Cancelar cambio de cuenta
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void confirm()}
            className="mr-2 px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            {pending
              ? 'Procesando…'
              : target === 'inactive'
                ? 'Confirmar baja de cuenta'
                : 'Confirmar reactivación de cuenta'}
          </button>
        </dialog>
      )}
    </>
  );
}
