import type { Asset } from '../types/asset';

/**
 * The plate is the surface behind a logo. Picking it automatically is what keeps
 * dark artwork visible in dark mode (and white artwork visible on light paper)
 * without ever recolouring or editing the original SVG.
 *
 * The rule uses the ink estimate generated from the file's own fill colours:
 *   dark ink   → light plate, regardless of theme
 *   light ink  → dark plate, regardless of theme
 *   mixed ink  → follow the theme (coloured logos read on both)
 */
export type PlateStyle = 'light' | 'dark' | 'grid';
export type PlatePreference = 'auto' | PlateStyle;

export function resolvePlate(
  asset: Pick<Asset, 'ink'> | null | undefined,
  preference: PlatePreference,
  theme: 'light' | 'dark',
): PlateStyle {
  if (preference !== 'auto') return preference;
  const ink = asset?.ink;
  if (!ink) return theme === 'dark' ? 'dark' : 'light';
  if (ink.tone === 'dark') return 'light';
  if (ink.tone === 'light') return 'dark';
  // Mixed artwork: a mid-tone plate keeps both dark and light strokes readable
  // in either theme, and avoids the stark white slab in dark mode.
  return theme === 'dark' ? 'dark' : 'light';
}

export const PLATE_OPTIONS: { value: PlatePreference; label: string; title: string }[] = [
  { value: 'auto', label: '自动', title: '按 Logo 实际颜色自动选择底色，保证看得见' },
  { value: 'light', label: '浅色', title: '始终使用浅色底板' },
  { value: 'dark', label: '深色', title: '始终使用深色底板' },
  { value: 'grid', label: '网格', title: '透明网格底板，便于检查边缘' },
];

/** True when the automatic rule had to override the theme to keep the mark visible. */
export function plateWasAdjusted(asset: Asset | null | undefined, theme: 'light' | 'dark'): boolean {
  if (!asset?.ink) return false;
  if (theme === 'dark' && asset.ink.tone === 'dark') return true;
  if (theme === 'light' && asset.ink.tone === 'light') return true;
  return false;
}
