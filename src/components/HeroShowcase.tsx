import { useMemo } from 'react';
import type { Asset } from '../types/asset';
import { useApp } from '../context/AppContext';
import { resolvePlate } from '../lib/plate';
import { LogoPlate } from './LogoImage';
import { formatBytes } from '../lib/format';
import { DownloadIcon, StarIcon } from './Icons';

/**
 * Hero showcase: instead of squeezing nine wide lockups into square tiles (which
 * made them look tiny and blank), show a realistic asset card plus two stacked
 * previews. Everything here is a real indexed asset — no mock artwork.
 */
export function HeroShowcase({ assets }: { assets: Asset[] }) {
  const { preferences, t } = useApp();

  const picks = useMemo(() => {
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const preferred = ['logos/abchina-rect', 'logos/hsbc', 'logos/icbc-rect', 'logos/boc', 'logos/ubs'];
    const chosen = preferred.map((id) => byId.get(id)).filter((asset): asset is Asset => Boolean(asset));
    if (chosen.length >= 3) return chosen;
    return assets.filter((asset) => asset.collection === 'logos' && asset.variant === 'rect').slice(0, 3);
  }, [assets]);

  if (picks.length === 0) {
    return <div className="showcase" aria-hidden style={{ minHeight: 320 }} />;
  }

  const [featured, ...rest] = picks;
  const featuredPlate = resolvePlate(featured, preferences.plate, preferences.theme);

  return (
    <div className="showcase" aria-hidden>
      <div className="showcase__card">
        <div className="showcase__preview">
          <LogoPlate asset={featured} plate={featuredPlate} loading="eager" alt="" />
        </div>
        <div className="showcase__meta">
          <span className="showcase__name">{featured.name}</span>
          <span className="showcase__sub">
            {featured.filename} · {formatBytes(featured.fileSize)}
          </span>
        </div>
        <div className="showcase__tools">
          <span>
            <StarIcon /> {t('card.favoriteShort')}
          </span>
          <span>
            <DownloadIcon /> {t('card.downloadShort')}
          </span>
          <span className="showcase__tools-accent">{t('card.selectShort')}</span>
        </div>
      </div>

      <div className="showcase__stack">
        {rest.slice(0, 2).map((asset) => {
          const plate = resolvePlate(asset, preferences.plate, preferences.theme);
          return (
            <div className="showcase__mini" key={asset.id}>
              <div className="showcase__mini-plate">
                <LogoPlate asset={asset} plate={plate} loading="eager" alt="" />
              </div>
              <div className="showcase__mini-meta">
                <span className="showcase__name">{asset.name}</span>
                <span className="showcase__sub">{formatBytes(asset.fileSize)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="showcase__caption">
        <span className="showcase__dot" />
        {t('hero.showcaseNote')}
      </div>
    </div>
  );
}
