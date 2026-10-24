import JSZip from 'jszip';
import { parseViewBox } from '../../shared/svg-analysis.mjs';

export type OutputFormat = 'png' | 'webp';

export interface ConvertOptions {
  width: number;
  height: number;
  format: OutputFormat;
  background: 'transparent' | string;
  quality?: number;
}

export interface ConvertedResult {
  blob: Blob;
  width: number;
  height: number;
  format: OutputFormat;
  bytes: number;
  dataUrl: string;
}

export const MAX_DIMENSION = 4096;
export const MIN_DIMENSION = 8;

/**
 * Defence in depth: the SVG is loaded through <img>, which never executes script,
 * but we still strip active content before it reaches the image decoder so the
 * same bytes cannot be reused inline by mistake.
 */
export function sanitizeSvgForRender(source: string): string {
  let out = source
    .replace(/<!DOCTYPE[^>]*(?:\[[\s\S]*?\]\s*)?>/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<foreignObject\b[^>]*\/>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<audio\b[\s\S]*?<\/audio\s*>/gi, '')
    .replace(/<video\b[\s\S]*?<\/video\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*"(?!#|data:)[^"]*"/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*'(?!#|data:)[^']*'/gi, '')
    .replace(/javascript:/gi, '');

  // Guarantee a root element with explicit sizing behaviour.
  if (!/<svg\b/i.test(out)) throw new Error('The file does not contain an <svg> element.');
  if (!/<svg[^>]*\sviewBox=/i.test(out)) {
    out = out.replace(/<svg\b/i, '<svg viewBox="0 0 1024 1024"');
  }
  return out.trim();
}

export function svgIntrinsicSize(source: string): { width: number; height: number } {
  const rootMatch = /<svg\b([^>]*)>/i.exec(source);
  const attrs = rootMatch?.[1] ?? '';
  const viewBoxMatch = /viewBox\s*=\s*"([^"]+)"/i.exec(attrs);
  const parsed = parseViewBox(viewBoxMatch?.[1]);
  if (parsed) return { width: parsed.width, height: parsed.height };
  const width = /(?:^|\s)width\s*=\s*"([\d.]+)/i.exec(attrs)?.[1];
  const height = /(?:^|\s)height\s*=\s*"([\d.]+)/i.exec(attrs)?.[1];
  return { width: Number(width) || 1024, height: Number(height) || 1024 };
}

/** Fit inside width x height while preserving the artwork's aspect ratio. */
export function fitWithin(
  intrinsic: { width: number; height: number },
  target: { width: number; height: number },
  mode: 'contain' | 'stretch' = 'contain',
) {
  const scaleX = target.width / intrinsic.width;
  const scaleY = target.height / intrinsic.height;
  if (mode === 'stretch') return { drawWidth: target.width, drawHeight: target.height, offsetX: 0, offsetY: 0 };
  const scale = Math.min(scaleX, scaleY);
  const drawWidth = Math.round(intrinsic.width * scale);
  const drawHeight = Math.round(intrinsic.height * scale);
  return {
    drawWidth,
    drawHeight,
    offsetX: Math.round((target.width - drawWidth) / 2),
    offsetY: Math.round((target.height - drawHeight) / 2),
  };
}

export function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 512;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The browser could not decode this SVG. It may be malformed or reference missing resources.'));
    };
    image.src = url;
  });
}

export async function convertSvg(
  source: string,
  options: ConvertOptions,
): Promise<ConvertedResult> {
  const width = clampDimension(options.width);
  const height = clampDimension(options.height);
  const clean = sanitizeSvgForRender(source);
  const intrinsic = svgIntrinsicSize(clean);
  const image = await loadImage(clean);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser does not expose a 2D canvas context.');

  if (options.background !== 'transparent') {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  const box = fitWithin(intrinsic, { width, height });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, box.offsetX, box.offsetY, box.drawWidth, box.drawHeight);

  const mime = options.format === 'png' ? 'image/png' : 'image/webp';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, options.format === 'webp' ? options.quality ?? 0.92 : undefined),
  );
  if (!blob) {
    throw new Error(
      options.format === 'webp'
        ? 'This browser could not encode WebP. Try PNG instead.'
        : 'The browser could not encode the image.',
    );
  }
  // A silent fallback to PNG would produce a file with the wrong extension.
  if (options.format === 'webp' && blob.type !== 'image/webp') {
    throw new Error('This browser silently substituted another format for WebP. Try PNG instead.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the generated image.'));
    reader.readAsDataURL(blob);
  });

  return { blob, width, height, format: options.format, bytes: blob.size, dataUrl };
}

export interface BatchItem {
  id: string;
  name: string;
  source: string;
}

export interface BatchResult {
  blob: Blob;
  filename: string;
  count: number;
  files: { id: string; name: string; bytes: number; path: string }[];
}

export async function convertBatchToZip(
  items: BatchItem[],
  options: ConvertOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<BatchResult> {
  if (items.length === 0) throw new Error('Nothing to convert.');
  const zip = new JSZip();
  const used = new Set<string>();
  const files: BatchResult['files'] = [];

  for (const [index, item] of items.entries()) {
    onProgress?.(index, items.length);
    const converted = await convertSvg(item.source, options);
    let base = item.id.replace(/[/\\]/g, '-').replace(/\.svg$/i, '');
    let path = `${base}.${options.format}`;
    let counter = 2;
    while (used.has(path.toLowerCase())) {
      path = `${base}-${counter}.${options.format}`;
      counter += 1;
    }
    used.add(path.toLowerCase());
    zip.file(path, converted.blob);
    files.push({ id: item.id, name: item.name, bytes: converted.bytes, path });
    onProgress?.(index + 1, items.length);
  }

  zip.file(
    'conversion.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        generator: 'Bancora — Open Bank Asset Toolkit',
        format: options.format,
        width: options.width,
        height: options.height,
        background: options.background,
        files,
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { blob, filename: `bancora-converted-${options.format}.zip`, count: files.length, files };
}
