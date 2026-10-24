import { useState } from 'react';
import type { Asset } from '../types/asset';
import { assetUrl } from '../lib/paths';
import { ImageIcon } from './Icons';
import type { PlateStyle } from '../lib/plate';

interface LogoImageProps {
  asset: Asset;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  alt?: string;
  /** Visual plate behind the artwork. */
  plate?: PlateStyle;
}

/**
 * Renders the original SVG through <img>. Using <img> (rather than inline SVG)
 * keeps hostile markup out of the document, preserves caching, and lets a broken
 * file degrade to a labelled placeholder instead of taking down the grid.
 */
export function LogoImage({ asset, className, loading = 'lazy', sizes, alt, plate = 'light' }: LogoImageProps) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(asset);

  if (failed) {
    return (
      <div className="plate" data-plate={plate} style={{ width: '100%', height: '100%' }}>
        <div className="plate__fallback" role="img" aria-label={`${asset.name} — 预览不可用`}>
          <ImageIcon />
          <span>预览不可用</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? `${asset.name} logo`}
      className={className}
      loading={loading}
      decoding="async"
      sizes={sizes}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Convenience wrapper: plate + image, used by cards and thumbnails. */
export function LogoPlate({
  asset,
  plate,
  className = '',
  loading = 'lazy',
  alt,
}: {
  asset: Asset;
  plate: PlateStyle;
  className?: string;
  loading?: 'lazy' | 'eager';
  alt?: string;
}) {
  return (
    <div className={`plate ${className}`} data-plate={plate}>
      <LogoImage asset={asset} plate={plate} loading={loading} alt={alt} />
    </div>
  );
}
