import { memo } from 'react';
import type { Asset } from '../types/asset';
import { formatBytes } from '../lib/format';
import { useApp } from '../context/AppContext';
import { resolvePlate } from '../lib/plate';
import { LogoPlate } from './LogoImage';
import { CheckIcon, DownloadIcon, PlusIcon, StarIcon } from './Icons';

interface LogoCardProps {
  asset: Asset;
  favorite: boolean;
  selected: boolean;
  onOpen: (asset: Asset) => void;
  onToggleFavorite: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onQuickDownload: (asset: Asset) => void;
  index: number;
}

/**
 * Card anatomy: artwork on a contrast-aware plate, then name, then an explicit
 * action row (favourite · download · select). The action row replaced floating
 * corner buttons so every control has a stable, labelled, thumb-sized target.
 */
export const LogoCard = memo(function LogoCard({
  asset,
  favorite,
  selected,
  onOpen,
  onToggleFavorite,
  onToggleSelect,
  onQuickDownload,
  index,
}: LogoCardProps) {
  const { preferences, t } = useApp();
  const plate = resolvePlate(asset, preferences.plate, preferences.theme);

  return (
    <article className="card" data-selected={selected}>
      <button
        type="button"
        className="card__preview"
        onClick={() => onOpen(asset)}
        aria-label={`${t('card.details')}: ${asset.name}`}
        data-testid="card-open"
      >
        <LogoPlate asset={asset} plate={plate} loading={index < 12 ? 'eager' : 'lazy'} alt={`${asset.name} logo`} />
      </button>

      <div className="card__meta">
        <span className="card__name" title={asset.name}>
          {asset.name}
        </span>
        <div className="card__sub">
          <span className="card__file" title={asset.filename}>
            {asset.filename}
          </span>
          <span className="card__dot" aria-hidden />
          <span>{formatBytes(asset.fileSize)}</span>
        </div>
      </div>

      <div className="card__tools" role="group" aria-label={asset.name}>
        <button
          type="button"
          className="card__tool"
          aria-pressed={favorite}
          aria-label={favorite ? `${t('card.unfavorite')}: ${asset.name}` : `${t('card.favorite')}: ${asset.name}`}
          title={favorite ? t('card.unfavorite') : t('card.favorite')}
          onClick={() => onToggleFavorite(asset.id)}
        >
          <StarIcon filled={favorite} />
          <span>{favorite ? t('card.favoritedShort') : t('card.favoriteShort')}</span>
        </button>

        <button
          type="button"
          className="card__tool"
          aria-label={`${t('card.download')}: ${asset.name}`}
          title={t('card.download')}
          onClick={() => onQuickDownload(asset)}
        >
          <DownloadIcon />
          <span>{t('card.downloadShort')}</span>
        </button>

        <button
          type="button"
          className="card__tool card__tool--select"
          aria-pressed={selected}
          aria-label={selected ? `${t('card.unselect')}: ${asset.name}` : `${t('card.select')}: ${asset.name}`}
          title={selected ? t('card.unselect') : t('card.select')}
          onClick={() => onToggleSelect(asset.id)}
          data-testid="card-select"
        >
          {selected ? <CheckIcon /> : <PlusIcon />}
          <span>{selected ? t('card.selectedShort') : t('card.selectShort')}</span>
        </button>
      </div>
    </article>
  );
});
