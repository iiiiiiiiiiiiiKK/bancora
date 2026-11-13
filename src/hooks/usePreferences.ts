import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeStorage } from '../lib/browser';
import { normalizePreferences, type Preferences } from '../lib/preferences';

export type { Preferences };

const STORAGE_KEY = 'bancora.preferences.v2';
const THEME_KEY = 'bancora.theme';

export function readInitialPreferences(domTheme?: string): Preferences {
  let legacyTheme: string | undefined;
  if (domTheme === undefined && typeof document !== 'undefined') {
    try {
      legacyTheme = document.documentElement.dataset.theme;
    } catch {
      // Use preference defaults in non-DOM environments.
    }
  }
  const stored: unknown = safeStorage.get<unknown>(STORAGE_KEY, {});
  return normalizePreferences(stored, domTheme ?? legacyTheme);
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => readInitialPreferences());

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.lang === 'zh' ? 'zh-CN' : 'en';
    safeStorage.set(STORAGE_KEY, preferences);
    try {
      window.localStorage.setItem(THEME_KEY, preferences.theme);
    } catch {
      // storage might be disabled; current session still works
    }
  }, [preferences]);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => {
      const candidate = { ...current, [key]: value };
      return normalizePreferences(candidate, current.theme);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferences((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const toggleLang = useCallback(() => {
    setPreferences((current) => ({ ...current, lang: current.lang === 'zh' ? 'en' : 'zh' }));
  }, []);

  return useMemo(() => ({ preferences, update, toggleTheme, toggleLang }), [preferences, update, toggleTheme, toggleLang]);
}
