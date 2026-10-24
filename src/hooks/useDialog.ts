import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Locks body scroll and traps Tab focus inside the element with id
 * `bancora-dialog` while `open` is true. The close callback is read from a ref so
 * a parent re-render (a favourite toggle, a copied value…) cannot restart the
 * effect and steal focus back to the first control.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = document.getElementById('bancora-dialog');
    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    if (container) {
      const first = focusables()[0];
      (first ?? container).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const nodes = focusables();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);
}
