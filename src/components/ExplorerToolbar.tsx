import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import type { SortKey } from '../lib/search';
import { PLATE_OPTIONS } from '../lib/plate';
import { useApp } from '../context/AppContext';
import { SearchIcon, XIcon, FilterIcon, GridIcon } from './Icons';

export interface Filters {
  query: string;
  collection: 'all' | 'logos' | 'other';
  variant: 'all' | 'plain' | 'rect' | 'badge';
  favoritesOnly: boolean;
  quality: 'all' | 'warning' | 'error';
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  collection: 'all',
  variant: 'all',
  favoritesOnly: false,
  quality: 'all',
  sort: 'name-asc',
};

interface ToolbarProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
  totalCount: number;
  favoriteCount: number;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  onQuickDownloadVisible: () => void;
  quickDownloadCount: number;
}

/** Search, sort, density and preview-plate controls. Filter groups live in the sidebar. */
export function ExplorerToolbar({
  filters,
  onChange,
  resultCount,
  totalCount,
  favoriteCount,
  compact,
  onCompactChange,
  onQuickDownloadVisible,
  quickDownloadCount,
}: ToolbarProps) {
  const { t, preferences, updatePreference } = useApp();
  const active =
    filters.query !== '' ||
    filters.collection !== 'all' ||
    filters.variant !== 'all' ||
    filters.favoritesOnly ||
    filters.quality !== 'all';

  return (
    <div className="explorer__bar">
      <div className="shell">
        <div className="explorer__bar-inner">
          <div className="search">
            <SearchIcon />
            <label className="visually-hidden" htmlFor="logo-search">
              {t('search.label')}
            </label>
            <input
              id="logo-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('search.placeholder')}
              value={filters.query}
              onChange={(event) => onChange({ ...filters, query: event.target.value })}
              data-testid="search-input"
            />
            {filters.query ? (
              <button
                type="button"
                className="search__clear"
                onClick={() => onChange({ ...filters, query: '' })}
                aria-label={t('search.clear')}
                data-testid="search-clear"
              >
                <XIcon width={14} height={14} />
              </button>
            ) : null}
          </div>

          <div className="explorer__tools">
            <label className="visually-hidden" htmlFor="logo-sort">
              {t('search.sort')}
            </label>
            <select
              id="logo-sort"
              className="toolbar-select"
              value={filters.sort}
              onChange={(event) => onChange({ ...filters, sort: event.target.value as SortKey })}
            >
              <option value="name-asc">{t('search.sort.nameAsc')}</option>
              <option value="name-desc">{t('search.sort.nameDesc')}</option>
              <option value="filename-asc">{t('search.sort.file')}</option>
              <option value="size-desc">{t('search.sort.sizeDesc')}</option>
              <option value="size-asc">{t('search.sort.sizeAsc')}</option>
            </select>

            <div className="segmented" role="group" aria-label={t('search.plate')}>
              {PLATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={preferences.plate === option.value}
                  onClick={() => updatePreference('plate', option.value)}
                  title={option.title}
                >
                  {t(`search.plate.${option.value}` as const)}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="chip chip--button"
              aria-pressed={compact}
              onClick={() => onCompactChange(!compact)}
              title={compact ? t('search.comfort') : t('search.compact')}
            >
              <GridIcon width={13} height={13} />
              {compact ? t('search.compact') : t('search.comfort')}
            </button>

            <button
              type="button"
              className="chip chip--button"
              aria-pressed={filters.favoritesOnly}
              onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
            >
              {t('search.favoritesOnly')}
              {favoriteCount > 0 ? <span style={{ color: 'var(--muted)' }}>{favoriteCount}</span> : null}
            </button>

            {quickDownloadCount > 0 ? (
              <button type="button" className="btn btn--sm btn--accent" onClick={onQuickDownloadVisible}>
                {t('search.basket')} ({quickDownloadCount})
              </button>
            ) : null}

            {active ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => onChange({ ...DEFAULT_FILTERS })}
                title={t('search.reset')}
              >
                <FilterIcon />
                {t('search.reset')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="explorer__meta">
          <span aria-live="polite">
            {t('search.showing')} <strong data-testid="result-count">{resultCount}</strong> {t('search.of')} {totalCount}{' '}
            {t('search.results')}
            {filters.query.trim() ? ` · ${t('search.matching')} “${filters.query.trim()}”` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Sidebar filter groups. Only metadata that actually exists is represented. */
export function FilterSidebar({
  filters,
  onChange,
  assets,
  favoriteCount,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  assets: Asset[];
  favoriteCount: number;
}) {
  const { t } = useApp();
  const counts = useMemo(() => {
    const byVariant: Record<string, number> = { all: assets.length, plain: 0, rect: 0, badge: 0 };
    let warning = 0;
    let error = 0;
    for (const asset of assets) {
      byVariant[asset.variant] = (byVariant[asset.variant] ?? 0) + 1;
      if (asset.quality.status === 'warning') warning += 1;
      if (asset.quality.status === 'error') error += 1;
    }
    return { byVariant, warning, error };
  }, [assets]);

  return (
    <aside className="filters" aria-label="Filters">
      <div className="filter-group">
        <div className="filter-group__head">{t('filters.collection')}</div>
        <div className="filter-group__options">
          {(
            [
              ['all', t('filters.allCollections'), assets.length],
              ['logos', 'logos/', assets.filter((a) => a.collection === 'logos').length],
              ['other', 'other/', assets.filter((a) => a.collection === 'other').length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              className="filter-option"
              aria-pressed={filters.collection === value}
              onClick={() => onChange({ ...filters, collection: value })}
            >
              {label}
              <span className="filter-option__count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group__head">{t('filters.variant')}</div>
        <div className="filter-group__options">
          {(['all', 'plain', 'rect', 'badge'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="filter-option"
              aria-pressed={filters.variant === value}
              onClick={() => onChange({ ...filters, variant: value })}
            >
              {value === 'all'
                ? t('filters.allVariants')
                : value === 'plain'
                  ? t('filters.plain')
                  : value === 'rect'
                    ? t('filters.rect')
                    : t('filters.badge')}
              <span className="filter-option__count">{counts.byVariant[value] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group__head">{t('filters.refine')}</div>
        <div className="filter-group__options">
          <button
            type="button"
            className="filter-option"
            aria-pressed={filters.favoritesOnly}
            onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          >
            {t('filters.favorites')}
            <span className="filter-option__count">{favoriteCount}</span>
          </button>
          <button
            type="button"
            className="filter-option"
            aria-pressed={filters.quality === 'warning'}
            onClick={() => onChange({ ...filters, quality: filters.quality === 'warning' ? 'all' : 'warning' })}
          >
            {t('filters.warning')}
            <span className="filter-option__count">{counts.warning}</span>
          </button>
          <button
            type="button"
            className="filter-option"
            aria-pressed={filters.quality === 'error'}
            onClick={() => onChange({ ...filters, quality: filters.quality === 'error' ? 'all' : 'error' })}
          >
            {t('filters.error')}
            <span className="filter-option__count">{counts.error}</span>
          </button>
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-group__head">{t('filters.unavailable')}</div>
        <p className="filter-note">{t('filters.note')}</p>
      </div>
    </aside>
  );
}
