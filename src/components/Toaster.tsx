import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToasts, dismissToast } from '../lib/toast';
import { AlertCircleIcon, CheckIcon, InfoIcon, XIcon } from './Icons';

export function Toaster() {
  const toasts = useToasts();
  useEffect(() => {
    // no-op: subscription happens in the hook
  }, [toasts]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`}>
          {toast.kind === 'success' ? (
            <CheckIcon className="toast__icon" />
          ) : toast.kind === 'error' ? (
            <AlertCircleIcon className="toast__icon" />
          ) : (
            <InfoIcon className="toast__icon" />
          )}
          <div>
            <div className="toast__title">{toast.title}</div>
            {toast.detail ? <div className="toast__detail">{toast.detail}</div> : null}
          </div>
          <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            <XIcon width={14} height={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
