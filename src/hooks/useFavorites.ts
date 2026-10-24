import { useCallback, useEffect, useState } from 'react';
import { safeStorage } from '../lib/browser';

const KEY = 'bancora.favorites.v1';

/**
 * Favourites are stored by stable asset id (never by list index), so adding or
 * removing assets upstream cannot silently point at a different logo.
 * Corrupt or unavailable storage degrades to an in-memory session list.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = safeStorage.get<unknown>(KEY, []);
    return Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [];
  });
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    const ok = safeStorage.set(KEY, favorites);
    setPersisted(ok);
  }, [favorites]);

  const toggle = useCallback((id: string) => {
    setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }, []);

  const add = useCallback((id: string) => {
    setFavorites((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const remove = useCallback((id: string) => {
    setFavorites((current) => current.filter((item) => item !== id));
  }, []);

  const clear = useCallback(() => setFavorites([]), []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, add, remove, clear, isFavorite, persisted };
}
