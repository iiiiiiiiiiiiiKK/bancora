import JSZip from 'jszip';
import type { Asset } from '../types/asset';
import { fetchSvgText } from './browser';
import { assetUrl, BASE_URL } from './paths';

export interface ZipManifestEntry {
  id: string;
  name: string;
  originalFilename: string;
  format: string;
  exportPath: string;
  bytes: number;
  source: { repository: string; collection: string; npmExport: string | null };
  license: { code: string; trademark: string; note: string };
  website: string | null;
}

export interface ZipResult {
  blob: Blob;
  filename: string;
  files: number;
  bytes: number;
  manifest: { generatedAt: string; toolkit: string; baseUrl: string; count: number; assets: ZipManifestEntry[] };
}

const README = `Bancora export
==============

This archive was generated in your browser by Bancora (Open Bank Asset Toolkit).
No files were uploaded to a server.

Contents
--------
logos/          Original SVG files, byte-for-byte as published in the repository.
manifest.json   One record per file: id, name, original filename, format,
                export path, size, source and licence fields.
README.txt      This file.

Formats
-------
All files in this export are SVG (Scalable Vector Graphics). They can be opened
in any browser, design tool or code editor and used directly with <img>,
CSS background-image or inline markup.

Metadata
--------
Bancora only publishes metadata that exists upstream. In this version:

  country / category        Not published upstream -> left empty. Never inferred.
  SWIFT / BIC               Not part of the dataset.
  source                    github.com/icongo/bank-logos
  licence (code and files)  MIT, Copyright (c) 2022 IconGo
  trademark permission      Unknown for every asset.

Where a bank name could not be confirmed from the upstream documentation, the
name is marked "tentative" in manifest.json (nameStatus). Treat those names as
labels for the artwork, not as confirmed institution identities.

Before you use a logo
---------------------
Bank logos and trademarks remain the property of their respective owners.
Bancora is an independent resource toolkit and is not affiliated with, endorsed
by, or sponsored by any of the listed institutions. MIT covers this repository
and its SVG files, not the trademarks they depict. Verify the source, current
brand guidelines and applicable usage terms before any commercial use.

Generated: %DATE%
Assets:    %COUNT%
`;

/** Sanitise a file name for cross-platform ZIP extraction. */
export function safeZipName(name: string, fallback = 'logo'): string {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned === '' ? fallback : cleaned.slice(0, 120);
}

/** Unique export paths: never overwrite a file that was already added. */
export function uniquePath(used: Set<string>, base: string, extension: string): string {
  let candidate = `${base}${extension}`;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}${extension}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export interface BuildOptions {
  onProgress?: (done: number, total: number, label: string) => void;
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException('Export cancelled', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/**
 * Accumulate the JSZip output through its public stream helper. Unlike
 * generateAsync, this allows us to pause production and reject immediately when
 * cancellation occurs; no ZIP chunk accumulator is retained after rejection.
 */
function generateBlob(
  zip: JSZip,
  signal: AbortSignal | undefined,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = zip.generateInternalStream({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/zip',
    });
    const chunks: BlobPart[] = [];
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      stream.pause();
      chunks.length = 0;
      reject(error);
    };
    const onAbort = () => fail(abortError());

    if (signal?.aborted) {
      fail(abortError());
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    stream.on('data', (chunk, metadata) => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      chunks.push(chunk as BlobPart);
      if (typeof metadata?.percent === 'number') onProgress(metadata.percent);
    });
    stream.on('error', (error) => fail(error));
    stream.on('end', () => {
      if (settled) return;
      if (signal?.aborted) {
        onAbort();
        return;
      }
      settled = true;
      cleanup();
      resolve(new Blob(chunks, { type: 'application/zip' }));
      chunks.length = 0;
    });
    stream.resume();

    // JSZip progress metadata is exposed by the stream helper as a `data` event.
    // Per-file progress is the primary UI signal; compression completion is 100%.
    void onProgress;
  });
}

export async function buildAssetsZip(assets: Asset[], options: BuildOptions = {}): Promise<ZipResult> {
  const unique = new Map<string, Asset>();
  for (const asset of assets) unique.set(asset.id, asset);
  const list = [...unique.values()];
  if (list.length === 0) throw new Error('Select at least one logo before exporting.');

  const zip = new JSZip();
  const folder = zip.folder('bancora-export');
  if (!folder) throw new Error('Could not create the archive folder.');
  const logos = folder.folder('logos');
  if (!logos) throw new Error('Could not create the logos folder.');

  const used = new Set<string>();
  const manifest: ZipManifestEntry[] = [];

  for (const [index, asset] of list.entries()) {
    throwIfAborted(options.signal);
    options.onProgress?.(index, list.length, asset.name);
    const { text, bytes } = await fetchSvgText(assetUrl(asset), options.signal);
    throwIfAborted(options.signal);
    const exportName = uniquePath(used, safeZipName(asset.filename.replace(/\.svg$/i, ''), asset.id.replace(/[/\\]/g, '-')), '.svg');
    logos.file(exportName, text);
    manifest.push({
      id: asset.id,
      name: asset.name,
      originalFilename: asset.filename,
      format: asset.format,
      exportPath: `logos/${exportName}`,
      bytes,
      source: { repository: asset.source.upstream, collection: asset.collection, npmExport: asset.source.npmExport },
      license: { code: asset.license.code, trademark: asset.license.trademark, note: asset.license.note },
      website: asset.website,
    });
  }

  throwIfAborted(options.signal);
  const generatedAt = new Date().toISOString();
  const manifestDoc = {
    generatedAt,
    toolkit: 'Bancora — Open Bank Asset Toolkit',
    baseUrl: BASE_URL,
    count: manifest.length,
    assets: manifest,
  };
  folder.file('manifest.json', JSON.stringify(manifestDoc, null, 2));
  folder.file('README.txt', README.replace('%DATE%', generatedAt).replace('%COUNT%', String(manifest.length)));

  options.onProgress?.(list.length, list.length, 'Writing archive');
  const blob = await generateBlob(zip, options.signal, (percent) => {
    options.onProgress?.(list.length, list.length, `Compressing ${Math.round(percent)}%`);
  });
  throwIfAborted(options.signal);
  const stamp = generatedAt.slice(0, 10).replace(/-/g, '');
  return { blob, filename: `bancora-export-${stamp}.zip`, files: manifest.length, bytes: blob.size, manifest: manifestDoc };
}
