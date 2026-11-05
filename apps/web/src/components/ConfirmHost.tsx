import { useEffect, useRef, useState, type ReactElement } from 'react';
import { setConfirmHandler, type ConfirmRequest } from '../services/confirm';

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

/** Renders confirmDialog() requests as a native modal <dialog>. */
export function ConfirmHost(): ReactElement | null {
  const [request, setRequest] = useState<Pending | null>(null);
  const current = useRef<Pending | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setConfirmHandler(
      (next) =>
        new Promise((resolve) => {
          // A newer question cancels the one still open.
          current.current?.resolve(false);
          current.current = { ...next, resolve };
          setRequest(current.current);
        })
    );
    return () => setConfirmHandler(null);
  }, []);
  useEffect(() => {
    if (request && !dialog.current?.open) dialog.current?.showModal();
  }, [request]);

  if (!request) return null;
  const answer = (ok: boolean) => {
    request.resolve(ok);
    current.current = null;
    dialog.current?.close();
    setRequest(null);
  };
  return (
    <dialog
      ref={dialog}
      className="ws-confirm"
      aria-labelledby="ws-confirm-title"
      aria-describedby={request.message ? 'ws-confirm-message' : undefined}
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) answer(false);
      }}
      // Escape answers this dialog only, not an overlay underneath.
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
    >
      <div className="ws-confirm-body">
        <h2 id="ws-confirm-title">{request.title}</h2>
        {request.message && <p id="ws-confirm-message">{request.message}</p>}
        <div className="ws-confirm-actions">
          <button
            type="button"
            className="ws-btn"
            onClick={() => answer(false)}
          >
            {request.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className="ws-btn"
            data-variant={request.danger ? 'danger' : 'primary'}
            onClick={() => answer(true)}
          >
            {request.confirmLabel ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
