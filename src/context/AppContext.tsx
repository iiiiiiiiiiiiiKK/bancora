import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Asset, Dataset } from '../types/asset';
import { useDataset } from '../hooks/useDataset';
import { useFavorites } from '../hooks/useFavorites';
import { useSelection } from '../hooks/useSelection';
import { usePreferences } from '../hooks/usePreferences';
import { translate, type DictKey, type Lang } from '../lib/i18n';

interface AppContextValue {
  dataset: Dataset | null;
  assets: Asset[];
  loading: boolean;
  error: string | null;
  favorites: ReturnType<typeof useFavorites>;
  selection: ReturnType<typeof useSelection>;
  preferences: ReturnType<typeof usePreferences>['preferences'];
  updatePreference: ReturnType<typeof usePreferences>['update'];
  toggleTheme: () => void;
  toggleLang: () => void;
  lang: Lang;
  t: (key: DictKey) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useDataset();
  const favorites = useFavorites();
  const selection = useSelection();
  const { preferences, update, toggleTheme, toggleLang } = usePreferences();

  const value = useMemo<AppContextValue>(() => {
    const lang = preferences.lang;
    return {
      dataset: state.status === 'ready' ? state.dataset : null,
      assets: state.status === 'ready' ? state.dataset.assets : [],
      loading: state.status === 'loading',
      error: state.status === 'error' ? state.error : null,
      favorites,
      selection,
      preferences,
      updatePreference: update,
      toggleTheme,
      toggleLang,
      lang,
      t: (key: DictKey) => translate(lang, key),
    };
  }, [state, favorites, selection, preferences, update, toggleTheme, toggleLang]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}
