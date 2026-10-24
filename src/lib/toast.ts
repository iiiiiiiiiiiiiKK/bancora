import { useEffect, useRef, useState } from 'react';

/** A toast queue with auto-dismiss. Module-level store so any component can push. */
export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

let counter = 0;
let toasts: Toast[] = [];
const listeners = new Set<(next: Toast[]) => void>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function pushToast(kind: ToastKind, title: string, detail?: string): number {
  const id = ++counter;
  toasts = [...toasts.slice(-3), { id, kind, title, detail }];
  emit();
  window.setTimeout(() => dismissToast(id), kind === 'error' ? 7000 : 4200);
  return id;
}

export function useToasts(): Toast[] {
  const snapshot = useRef<Toast[]>(toasts);
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = (next: Toast[]) => {
      snapshot.current = next;
      setTick((value) => value + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot.current;
}
