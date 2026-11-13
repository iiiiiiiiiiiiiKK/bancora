import type { Lang } from './i18n';
import type { PlatePreference } from './plate';

export interface Preferences {
  theme: 'light' | 'dark';
  plate: PlatePreference;
  compactGrid: boolean;
  lang: Lang;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  plate: 'auto',
  compactGrid: false,
  lang: 'zh',
};

/** Whitelist persisted values so stale/corrupt localStorage cannot leak arbitrary
 * property values into CSS, labels or component state. */
export function normalizePreferences(value: unknown, domTheme?: string): Preferences {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const themeCandidate = raw.theme ?? domTheme;
  const theme: Preferences['theme'] = themeCandidate === 'dark' ? 'dark' : 'light';
  const plate: PlatePreference = raw.plate === 'light' || raw.plate === 'dark' || raw.plate === 'grid' ? raw.plate : 'auto';
  const compactGrid = typeof raw.compactGrid === 'boolean' ? raw.compactGrid : DEFAULT_PREFERENCES.compactGrid;
  const lang: Lang = raw.lang === 'en' ? 'en' : 'zh';
  return { theme, plate, compactGrid, lang };
}
