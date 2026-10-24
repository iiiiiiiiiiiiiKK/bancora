import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeStorage } from '../lib/browser';
import type { Lang } from '../lib/i18n';
import type { PlatePreference } from '../lib/plate';

export interface Preferences {
  theme: 'light' | 'dark';
  /** auto keeps dark/white artwork visible in both themes. */
  plate: PlatePreference;
  compactGrid: boolean;
  lang: Lang;
}

const STORAGE_KEY = 'bancora.preferences.v2';
const THEME_KEY = 'bancora.theme';

const DEFAULTS: Preferences = {
  theme: 'light',
  plate: 'auto',
  compactGrid: false,
  lang: 'zh',
};

function readInitial(): Preferences {
  const stored = safeStorage.get<Partial<Preferences>>(STORAGE_KEY, {});
  let theme = stored.theme;
  if (!theme) {
    try {
      const domTheme = document.documentElement.dataset.theme;
      if (domTheme === 'dark' || domTheme === 'light') theme = domTheme;
    } catch {
      /* ignore */
    }
  }
  const lang: Lang = stored.lang === 'en' ? 'en' : 'zh';
  const plate: PlatePreference =
    stored.plate === 'light' || stored.plate === 'dark' || stored.plate === 'grid' ? stored.plate : 'auto';
  return { ...DEFAULTS, ...stored, theme: theme === 'dark' ? 'dark' : 'light', plate, lang };
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.lang === 'zh' ? 'zh-CN' : 'en';
    safeStorage.set(STORAGE_KEY, preferences);
    try {
      window.localStorage.setItem(THEME_KEY, preferences.theme);
    } catch {
      /* ignore */
    }
  }, [preferences]);

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferences((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const toggleLang = useCallback(() => {
    setPreferences((current) => ({ ...current, lang: current.lang === 'zh' ? 'en' : 'zh' }));
  }, []);

  return useMemo(
    () => ({ preferences, update, toggleTheme, toggleLang }),
    [preferences, update, toggleTheme, toggleLang],
  );
}
