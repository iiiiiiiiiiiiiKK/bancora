import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import { useApp } from '../context/AppContext';
import { LogoImage } from './LogoImage';

/**
 * A single quiet rail of real logos under the hero statistics.
 *
 * Purpose: the hero used to stop at the stat band, which left the first screen
 * feeling like a form rather than a collection. This rail shows twelve genuine
 * assets from the index, so the first screen says "606 logos" visually instead
 * of only numerically.
 *
 * The rail uses one uniform plate per theme (paper in light, ink in dark) rather
 * than per-asset contrast plates — a mixed rail of light and dark tiles reads as
 * a checkerboard. To keep that safe only artwork that stays visible on the
 * uniform plate is sampled.
 */
export function LogoBand({ assets }: { assets: Asset[] }) {
  const { preferences } = useApp();
  const dark = preferences.theme === 'dark';

  const picks = useMemo(() => {
    if (assets.length === 0) return [];
    // Light rail = paper, so dark and mixed artwork is safe.
    // Dark rail = ink, so light and mixed artwork is safe.
    const visible = assets.filter((asset) => {
      const tone = asset.ink?.tone;
      if (!tone) return true;
      return dark ? tone !== 'dark' : tone !== 'light';
    });
    const pool = visible.length >= 12 ? visible : assets;
    const wanted = 12;
    const step = Math.max(1, Math.floor(pool.length / wanted));
    const out: Asset[] = [];
    for (let i = 0; out.length < wanted && i < pool.length; i += step) {
      out.push(pool[i]);
    }
    return out;
  }, [assets, dark]);

  if (picks.length < 6) return null;

  return (
    <div className="logo-band" data-tone={dark ? 'dark' : 'light'} aria-hidden>
      {picks.map((asset) => (
        <div className="logo-band__cell" key={asset.id}>
          <LogoImage asset={asset} plate={dark ? 'dark' : 'light'} loading="lazy" alt="" />
        </div>
      ))}
    </div>
  );
}
