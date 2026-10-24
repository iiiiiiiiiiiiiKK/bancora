import { useMemo, useState } from 'react';
import type { Asset } from '../types/asset';
import { analyzeSvg, type SvgAnalysis } from '../../shared/svg-analysis.mjs';

export interface InspectionEntry {
  key: string;
  name: string;
  source: 'repository' | 'upload';
  asset?: Asset;
  url?: string;
  bytes: number;
  sha256: string;
  signature: string | null;
  analysis: SvgAnalysis;
}

/** SHA-256 of the raw bytes, hex encoded. Falls back to a length+text digest. */
async function hashText(text: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtle requires a secure context; use a deterministic fallback.
    let h1 = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    return `fallback-${h1.toString(16)}-${text.length}`;
  }
}

/** Concatenated path data — detects visually identical exports with different wrappers. */
function pathSignature(text: string): string | null {
  const parts: string[] = [];
  const re = /\sd\s*=\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) parts.push(match[1].replace(/\s+/g, ''));
  if (parts.length === 0) return null;
  const joined = parts.join('|');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < joined.length; i += 1) {
    h1 ^= joined.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(16);
}

/** Structural checks over repository assets, computed in the browser from the raw text. */
export function useInspector() {
  const [entries, setEntries] = useState<InspectionEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function inspectRepository(assets: Asset[], limit = assets.length) {
    const targets = assets.slice(0, limit);
    setRunning(true);
    setProgress({ done: 0, total: targets.length });
    const collected: InspectionEntry[] = [];
    for (const [index, asset] of targets.entries()) {
      try {
        const response = await fetch(asset.publicPath, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        collected.push({
          key: asset.id,
          name: asset.name,
          source: 'repository',
          asset,
          url: asset.publicPath,
          bytes: new TextEncoder().encode(text).length,
          sha256: await hashText(text),
          signature: pathSignature(text),
          analysis: analyzeSvg(asset.relativePath, text),
        });
      } catch (error) {
        collected.push({
          key: asset.id,
          name: asset.name,
          source: 'repository',
          asset,
          url: asset.publicPath,
          bytes: 0,
          sha256: '',
          signature: null,
          analysis: {
            file: asset.relativePath,
            bytes: 0,
            format: 'svg',
            status: 'error',
            counts: { error: 1, warning: 0, info: 0 },
            findings: [
              {
                code: 'FETCH_FAILED',
                severity: 'error',
                message: error instanceof Error ? error.message : 'Could not load file.',
              },
            ],
            wellFormed: false,
            externalRefs: [],
          },
        });
      }
      setProgress({ done: index + 1, total: targets.length });
      // Yield between files so the UI can paint progress.
      if (index % 25 === 24) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setEntries(collected);
    setRunning(false);
    return collected;
  }

  const [uploads, setUploads] = useState<InspectionEntry[]>([]);

  async function inspectFiles(files: File[]) {
    const results: InspectionEntry[] = [];
    for (const file of files) {
      const text = await file.text();
      results.push({
        key: `upload:${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        source: 'upload',
        bytes: file.size,
        sha256: await hashText(text),
        signature: pathSignature(text),
        analysis: analyzeSvg(file.name, text),
      });
    }
    setUploads((current) => [...results, ...current].slice(0, 200));
    return results;
  }

  return useMemo(
    () => ({ entries, uploads, running, progress, inspectRepository, inspectFiles, setUploads }),
    [entries, uploads, running, progress],
  );
}
