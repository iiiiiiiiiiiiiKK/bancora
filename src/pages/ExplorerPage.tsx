import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DEFAULT_FILTERS, ExplorerToolbar, FilterSidebar, type Filters } from '../components/ExplorerToolbar';
import { LogoCard } from '../components/LogoCard';
import { DetailsDialog } from '../components/DetailsDialog';
import { ExportBasket } from '../components/ExportBasket';
import { HeroShowcase } from '../components/HeroShowcase';
import { StatsBar } from '../components/StatsBar';
import { LogoBand } from '../components/LogoBand';
import { buildSearchIndex, matchesQuery, sortAssets } from '../lib/search';
import { fetchSvgText, downloadText } from '../lib/browser';
import { pushToast } from '../lib/toast';
import { assetUrl, withBase } from '../lib/paths';
import type { Asset } from '../types/asset';
import { AlertCircleIcon, ArrowRightIcon, DownloadIcon, FileIcon, FilterIcon, SearchIcon, StarIcon } from '../components/Icons';

const PAGE_SIZE = 72;

export function ExplorerPage() {
  const { assets, loading, error, favorites, selection, preferences, updatePreference, t, lang } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    query: searchParams.get('q') ?? '',
    collection: (searchParams.get('collection') as Filters['collection']) || 'all',
    favoritesOnly: searchParams.get('favorites') === '1',
  }));
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [active, setActive] = useState<Asset | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchIndex = useMemo(() => buildSearchIndex(assets), [assets]);

  const filtered = useMemo(() => {
    const matched: Asset[] = [];
    for (const entry of searchIndex) {
      const asset = entry.asset;
      if (!matchesQuery(entry, filters.query)) continue;
      if (filters.collection !== 'all' && asset.collection !== filters.collection) continue;
      if (filters.variant !== 'all' && asset.variant !== filters.variant) continue;
      if (filters.favoritesOnly && !favorites.isFavorite(asset.id)) continue;
      if (filters.quality !== 'all' && asset.quality.status !== filters.quality) continue;
      matched.push(asset);
    }
    return sortAssets(matched, filters.sort);
  }, [searchIndex, filters, favorites]);

  const activeFilterCount =
    (filters.collection !== 'all' ? 1 : 0) +
    (filters.variant !== 'all' ? 1 : 0) +
    (filters.quality !== 'all' ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filters]);

  // Collapse the phone filter sheet once a filter is applied.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) setFiltersOpen(false);
  }, [filters.collection, filters.variant, filters.quality, filters.favoritesOnly]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filters.query.trim()) next.set('q', filters.query);
    else next.delete('q');
    if (filters.collection !== 'all') next.set('collection', filters.collection);
    else next.delete('collection');
    if (filters.favoritesOnly) next.set('favorites', '1');
    else next.delete('favorites');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query, filters.collection, filters.favoritesOnly]);

  useEffect(() => {
    const wanted = searchParams.get('favorites') === '1';
    setFilters((current) => (current.favoritesOnly === wanted ? current : { ...current, favoritesOnly: wanted }));
  }, [searchParams]);

  const visibleAssets = filtered.slice(0, visible);
  const selectedAssets = assets.filter((asset) => selection.has(asset.id));

  const openAsset = useCallback((asset: Asset) => setActive(asset), []);

  const quickDownload = useCallback(
    async (asset: Asset) => {
      setQuickBusy(asset.id);
      try {
        const result = await fetchSvgText(assetUrl(asset));
        downloadText(result.text, asset.filename, 'image/svg+xml');
        pushToast('success', lang === 'zh' ? '已开始下载' : 'Download started', asset.filename);
      } catch (err) {
        pushToast('error', lang === 'zh' ? '下载失败' : 'Download failed', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setQuickBusy(null);
      }
    },
    [lang],
  );

  return (
    <>
      {/* Hero: asymmetric two-column composition. The copy column carries the
          value proposition, the gallery column carries the proof. They share a
          baseline grid and both end on the same hairline, so the block has a
          clear start, focal point and end. */}
      <section className="hero">
        <div className="shell hero__shell">
          <div className="hero__grid">
            <div className="hero__copy">
              <span className="hero__eyebrow">Open Bank Asset Toolkit</span>
              <h1 className="hero__title">
                {t('hero.title')}
                <em>{t('hero.titleAccent')}</em>
              </h1>
              <p className="hero__lede">{t('hero.lede')}</p>
              <div className="hero__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {t('hero.explore')}
                  <ArrowRightIcon />
                </button>
                <button type="button" className="btn btn--lg" onClick={() => setBasketOpen(true)}>
                  <DownloadIcon />
                  {t('hero.basket')}
                </button>
                <a className="btn btn--soft btn--lg" href={withBase('/data/assets.json')} download>
                  <FileIcon />
                  {t('hero.index')}
                </a>
              </div>
              <p className="hero__hint">{t('hero.exploreHint')}</p>
            </div>

            <HeroShowcase assets={assets} />
          </div>
        </div>
      </section>

      {/* Statistics: its own band with real figures, separated from the hero by a
          hairline instead of being squeezed into the copy column. */}
      <section className="stats-band">
        <div className="shell">
          <StatsBar />
        </div>
      </section>

      {/* Featured logos: a real 6×2 grid, not a single squeezed row. */}
      <div className="shell">
        <LogoBand assets={assets} />
      </div>

      <ExplorerToolbar
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        totalCount={assets.length}
        favoriteCount={favorites.favorites.length}
        compact={preferences.compactGrid}
        onCompactChange={(value) => updatePreference('compactGrid', value)}
        onQuickDownloadVisible={() => setBasketOpen(true)}
        quickDownloadCount={selectedAssets.length}
      />

      <section className="shell" id="explorer" aria-label={t('nav.explore')}>
        {error ? (
          <div className="alert alert--error" role="alert" style={{ marginTop: 20 }}>
            <AlertCircleIcon />
            <div>
              <strong>{lang === 'zh' ? '素材索引加载失败。' : 'The asset index could not be loaded.'}</strong>
              <div>{error}</div>
              <button type="button" className="btn btn--sm" style={{ marginTop: 10 }} onClick={() => window.location.reload()}>
                {t('common.retry')}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="explorer__body">
            <div className="filters" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 96 }} />
              ))}
            </div>
            <div className="grid" aria-busy="true">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="card">
                  <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
                  <div style={{ padding: 11 }}>
                    <div className="skeleton" style={{ height: 11, width: '76%' }} />
                    <div className="skeleton" style={{ height: 9, width: '46%', marginTop: 7 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && !error ? (
          <div className={`explorer__body${filtersOpen ? ' filters-open' : ''}`}>
            <button
              type="button"
              className="filters-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <FilterIcon width={14} height={14} />
              {t('filters.toggle')}
              {activeFilterCount > 0 ? <span className="filters-toggle__count">{activeFilterCount}</span> : null}
              <span aria-hidden>{filtersOpen ? '−' : '+'}</span>
            </button>
            <FilterSidebar filters={filters} onChange={setFilters} assets={assets} favoriteCount={favorites.favorites.length} />

            <div>
              {filtered.length > 0 ? (
                <>
                  <div className="results__title">
                    <h2 className="results__heading">{t('results.browseAll')}</h2>
                    <p className="results__note">{t('results.browseHint')}</p>
                  </div>

                  <div className="results__head">
                    <div className="row" style={{ gap: 6 }}>
                      <button type="button" className="btn btn--sm" onClick={() => selection.addMany(visibleAssets.map((a) => a.id))}>
                        {t('results.selectVisible')} ({visibleAssets.length})
                      </button>
                      {filtered.length > visibleAssets.length ? (
                        <button type="button" className="btn btn--sm" onClick={() => selection.addMany(filtered.map((a) => a.id))}>
                          {t('results.selectAll')} ({filtered.length})
                        </button>
                      ) : null}
                      {selection.ids.length > 0 ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={selection.clear}>
                          {t('results.clear')}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className={`grid${preferences.compactGrid ? ' grid--compact' : ''}`} data-testid="logo-grid">
                    {visibleAssets.map((asset, index) => (
                      <LogoCard
                        key={asset.id}
                        asset={asset}
                        index={index}
                        favorite={favorites.isFavorite(asset.id)}
                        selected={selection.has(asset.id)}
                        onOpen={openAsset}
                        onToggleFavorite={favorites.toggle}
                        onToggleSelect={selection.toggle}
                        onQuickDownload={(assetToDownload) => {
                          if (quickBusy) return;
                          void quickDownload(assetToDownload);
                        }}
                      />
                    ))}
                  </div>

                  {visible < filtered.length ? (
                    <div className="load-more">
                      <div className="load-more__meta">
                        <span>
                          {t('results.showingN')}{' '}
                          <strong>
                            {visible} / {filtered.length}
                          </strong>
                        </span>
                        <div className="load-more__track" aria-hidden>
                          <span style={{ width: `${Math.min(100, Math.round((visible / filtered.length) * 100))}%` }} />
                        </div>
                      </div>
                      <button type="button" className="btn btn--primary load-more__btn" onClick={() => setVisible((value) => value + PAGE_SIZE)}>
                        {t('results.loadMore')}
                        <span className="load-more__count">+{Math.min(PAGE_SIZE, filtered.length - visible)}</span>
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="empty" data-testid="empty-state">
                  <div className="empty__icon">{filters.favoritesOnly ? <StarIcon /> : <SearchIcon />}</div>
                  <h3>{filters.favoritesOnly ? t('results.noneFav') : t('results.none')}</h3>
                  <p>{filters.favoritesOnly ? t('results.noneFavHint') : t('results.noneHint')}</p>
                  <button type="button" className="btn btn--sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
                    {t('results.clearFilters')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <DetailsDialog asset={active} onClose={() => setActive(null)} />
      <ExportBasket
        open={basketOpen}
        assets={selectedAssets}
        onRemove={selection.remove}
        onClear={selection.clear}
        onClose={() => setBasketOpen(false)}
      />

      {selection.ids.length > 0 && !basketOpen ? (
        <div className="tray" role="region" aria-label={t('search.basket')}>
          <div className="tray__count">
            {t('tray.selected')} <span>{selection.ids.length}</span>
          </div>
          <div className="tray__actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setBasketOpen(true)}>
              {t('tray.review')}
            </button>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => setBasketOpen(true)}>
              <DownloadIcon />
              {t('tray.export')}
            </button>
          </div>
          <button type="button" className="tray__close" onClick={selection.clear} aria-label={t('tray.clear')}>
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
