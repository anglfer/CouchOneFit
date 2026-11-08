export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmHandler = (request: ConfirmRequest) => Promise<boolean>;
let handler: ConfirmHandler | null = null;

/**
 * In-app replacement for window.confirm. <ConfirmHost /> renders the dialog;
 * without a host nothing is confirmed, so destructive actions never run blind.
 */
export function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  return handler ? handler(request) : Promise.resolve(false);
}

export function setConfirmHandler(next: ConfirmHandler | null): void {
  handler = next;
}
