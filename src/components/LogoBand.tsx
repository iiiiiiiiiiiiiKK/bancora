import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import { useApp } from '../context/AppContext';
import { LogoImage } from './LogoImage';

/**
 * Featured logos — twelve real assets in a regular grid.
 *
 * This replaced a single-row rail. The rail forced twelve cells into one line and
 * hid the overflow, so at 1440px every artwork was taller than its cell and got
 * cut off at the top and bottom. A grid with wrapping solves it structurally:
 * six columns on desktop, four on tablet, two on phones, and every cell keeps a
 * definite art box so nothing is ever clipped.
 *
 * Names are shown because a logo wall without names is just decoration; the name
 * wraps to two lines instead of being ellipsised away.
 */
export function LogoBand({ assets }: { assets: Asset[] }) {
  const { preferences, t } = useApp();
  const dark = preferences.theme === 'dark';

  const picks = useMemo(() => {
    if (assets.length === 0) return [];
    // Uniform plate per theme keeps the wall from looking like a checkerboard,
    // so only artwork that stays visible on that plate is sampled.
    const visible = assets.filter((asset) => {
      const tone = asset.ink?.tone;
      if (!tone) return true;
      return dark ? tone !== 'dark' : tone !== 'light';
    });
    const pool = visible.length >= 12 ? visible : assets;
    const wanted = 12;
    const step = Math.max(1, Math.floor(pool.length / wanted));
    const out: Asset[] = [];
    for (let i = 0; i < pool.length && out.length < wanted; i += step) out.push(pool[i]);
    return out;
  }, [assets, dark]);

  if (picks.length < 6) return null;

  return (
    <section className="featured" aria-label={t('featured.title')}>
      <div className="featured__head">
        <div>
          <h2 className="featured__title">{t('featured.title')}</h2>
          <p className="featured__note">{t('featured.note')}</p>
        </div>
        <span className="featured__count">
          {picks.length} <span aria-hidden>/</span> {assets.length}
        </span>
      </div>

      <ul className="logo-band" data-tone={dark ? 'dark' : 'light'}>
        {picks.map((asset) => (
          <li className="logo-band__cell" key={asset.id}>
            <div className="logo-band__art">
              <LogoImage asset={asset} plate={dark ? 'dark' : 'light'} loading="lazy" alt="" />
            </div>
            <span className="logo-band__name" title={asset.name}>
              {asset.name}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
