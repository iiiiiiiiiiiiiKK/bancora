import type { Asset } from '../types/asset';

/** The public base path this deployment is served from (always starts and ends with "/"). */
export const BASE_URL = import.meta.env.BASE_URL || '/';

/** Join a site-relative path with the deployment base path. */
export function withBase(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}${clean}`;
}

/** Absolute URL on the current origin — what a user can paste into a browser. */
export function absoluteUrl(path: string): string {
  if (typeof window === 'undefined') return withBase(path);
  return new URL(withBase(path), window.location.href).href;
}

/** URL of the original SVG in this deployment (respects sub-path hosting). */
export function assetUrl(asset: Asset): string {
  return withBase(asset.publicPath);
}

export function assetAbsoluteUrl(asset: Asset): string {
  return absoluteUrl(asset.publicPath);
}

/** GitHub source URL, for provenance only. */
export function githubSourceUrl(asset: Asset): string {
  return `https://github.com/icongo/bank-logos/blob/main/${asset.collection}/${encodeURIComponent(asset.filename)}`;
}

const safeAlt = (value: string) => value.replace(/["\\]/g, "'").replace(/\s+/g, ' ').trim();

/** Suggested display size that keeps the logo's aspect ratio. */
export function displaySize(asset: Asset, box = 240): { width: number; height: number } {
  const w = asset.width ?? 1024;
  const h = asset.height ?? 1024;
  if (!w || !h) return { width: box, height: box };
  const scale = box / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function htmlSnippet(asset: Asset): string {
  const { width, height } = displaySize(asset, 240);
  return `<img
  src="${assetUrl(asset)}"
  alt="${safeAlt(asset.name)}"
  width="${width}"
  height="${height}"
  loading="lazy"
  decoding="async"
/>`;
}

export function reactSnippet(asset: Asset): string {
  const { width, height } = displaySize(asset, 240);
  const component = (asset.source.npmExport || 'BankLogo').replace(/[^A-Za-z0-9_]/g, '');
  const safeComponent = /^[A-Za-z_]/.test(component) ? component : 'BankLogo';
  return `import type { ImgHTMLAttributes } from "react";

/** Copy the SVG into your public/ folder and keep this path in sync. */
const src = "${assetUrl(asset)}";

export function ${safeComponent}(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src}
      alt="${safeAlt(asset.name)}"
      width={${width}}
      height={${height}}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}`;
}

export function cssSnippet(asset: Asset): string {
  return `.bank-logo {
  background-image: url("${assetUrl(asset)}");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  width: 120px;
  height: 120px;
}`;
}

/** JSON record without the heavy quality details, suitable for copy/paste. */
export function assetJson(asset: Asset): string {
  return JSON.stringify(
    {
      id: asset.id,
      name: asset.name,
      nameStatus: asset.nameStatus,
      aliases: asset.aliases,
      filename: asset.filename,
      relativePath: asset.relativePath,
      publicPath: asset.publicPath,
      collection: asset.collection,
      variant: asset.variant,
      format: asset.format,
      fileSize: asset.fileSize,
      viewBox: asset.viewBox,
      width: asset.width,
      height: asset.height,
      country: asset.country,
      category: asset.category,
      website: asset.website,
      source: asset.source,
      license: asset.license,
    },
    null,
    2,
  );
}
