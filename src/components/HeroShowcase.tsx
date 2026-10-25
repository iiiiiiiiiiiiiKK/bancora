import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import { useApp } from '../context/AppContext';
import { resolvePlate } from '../lib/plate';
import { LogoImage } from './LogoImage';
import { formatBytes } from '../lib/format';

/**
 * Hero gallery — the visual anchor of the first screen.
 *
 * Composition: five real assets on one sheet. One tall "featured" cell occupies
 * the whole left column; four smaller marks fill a 2×2 block beside it. That
 * gives the first screen an asymmetric but ordered structure instead of a
 * symmetrical pair of equal boxes.
 *
 * Sizing rules that matter (they are why logos used to spill out of their tiles):
 *  - every art box has a DEFINITE height, so `max-height: 100%` resolves and
 *    `object-fit: contain` can actually do its job;
 *  - the image keeps its intrinsic ratio: no stretching, no cropping;
 *  - the featured cell gets more room, never a scaled-up copy of the artwork.
 */
export function HeroShowcase({ assets }: { assets: Asset[] }) {
  const { preferences, t } = useApp();

  const picks = useMemo(() => {
    if (assets.length === 0) return [];
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const preferred = ['logos/hsbc', 'logos/abchina-rect', 'logos/icbc-rect', 'logos/boc', 'logos/ubs'];
    const chosen = preferred.map((id) => byId.get(id)).filter((asset): asset is Asset => Boolean(asset));
    if (chosen.length >= 5) return chosen;
    // Deterministic fallback across the whole collection — never invented data.
    const step = Math.max(1, Math.floor(assets.length / 5));
    const out: Asset[] = [];
    for (let i = 0; i < assets.length && out.length < 5; i += step) out.push(assets[i]);
    return out;
  }, [assets]);

  if (picks.length < 4) {
    return <div className="hero-gallery" aria-hidden style={{ minHeight: 300 }} />;
  }

  const [featured, ...rest] = picks;

  return (
    <div className="hero-gallery" aria-hidden>
      <div className="hero-gallery__grid">
        <figure className="hero-gallery__cell hero-gallery__cell--featured">
          <div className="hero-gallery__art">
            <LogoImage
              asset={featured}
              plate={resolvePlate(featured, preferences.plate, preferences.theme)}
              loading="eager"
              alt=""
            />
          </div>
          <figcaption className="hero-gallery__meta">
            <span className="hero-gallery__name">{featured.name}</span>
            <span className="hero-gallery__sub">SVG · {formatBytes(featured.fileSize)}</span>
          </figcaption>
        </figure>

        {rest.slice(0, 4).map((asset) => (
          <figure className="hero-gallery__cell" key={asset.id}>
            <div className="hero-gallery__art">
              <LogoImage
                asset={asset}
                plate={resolvePlate(asset, preferences.plate, preferences.theme)}
                loading="eager"
                alt=""
              />
            </div>
            <figcaption className="hero-gallery__name hero-gallery__name--small">{asset.name}</figcaption>
          </figure>
        ))}
      </div>

      <p className="hero-gallery__caption">
        <span className="hero-gallery__dot" />
        {t('hero.showcaseNote')}
      </p>
    </div>
  );
}
