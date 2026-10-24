import { useCallback, useEffect, useRef, useState } from 'react';
import { safeStorage } from '../lib/browser';

export interface SelectionState {
  ids: string[];
}

const KEY = 'bancora.selection.v1';

/** Multi-select basket used by the batch export panel. Stored by stable id. */
export function useSelection() {
  const [ids, setIds] = useState<string[]>(() => {
    const stored = safeStorage.get<unknown>(KEY, []);
    return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [];
  });
  const [open, setOpen] = useState(false);
  const lastAdded = useRef<string | null>(null);

  useEffect(() => {
    safeStorage.set(KEY, ids);
  }, [ids]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const add = useCallback((id: string) => {
    setIds((current) => (current.includes(id) ? current : [...current, id]));
    lastAdded.current = id;
  }, []);

  const addMany = useCallback((next: string[]) => {
    setIds((current) => {
      const merged = [...current];
      for (const id of next) if (!merged.includes(id)) merged.push(id);
      return merged;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setIds((current) => current.filter((item) => item !== id));
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }, []);

  const clear = useCallback(() => setIds([]), []);

  return { ids, has, add, addMany, remove, toggle, clear, open, setOpen, lastAdded: lastAdded.current };
}
