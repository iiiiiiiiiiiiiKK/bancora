import type { Asset } from '../types/asset';

/**
 * Search normalisation: case-insensitive, whitespace-tolerant, punctuation-tolerant.
 * The same normaliser is applied to the query and to every indexed field so that
 * "bank of china", "BankofChina" and "bank-of-china" all hit the same record.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    // Treat punctuation and symbols as separators so "abchina-rect",
    // "abchina.rect" and "abchina rect" all tokenise identically.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface SearchIndexEntry {
  asset: Asset;
  haystack: string;
}

export function buildSearchIndex(assets: Asset[]): SearchIndexEntry[] {
  return assets.map((asset) => ({
    asset,
    haystack: normalize(
      [
        asset.name,
        ...asset.aliases,
        asset.filename,
        asset.id,
        asset.source.npmExport ?? '',
        asset.variant,
      ].join(' '),
    ),
  }));
}

/** Every whitespace-separated token must match somewhere in the record. */
export function matchesQuery(entry: SearchIndexEntry, query: string): boolean {
  const normalized = normalize(query);
  if (!normalized) return true;
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.every((token) => entry.haystack.includes(token))) return true;
  // Fallback: ignore separators entirely so "abchinarect" still finds
  // "abchina rect". Cheap because the fallback only runs when tokens fail.
  return entry.haystack.replace(/\s+/g, '').includes(normalized.replace(/\s+/g, ''));
}

export type SortKey = 'name-asc' | 'name-desc' | 'filename-asc' | 'size-desc' | 'size-asc';

const collator = new Intl.Collator(['zh-Hans-CN', 'en'], { numeric: true, sensitivity: 'base' });

export function sortAssets(assets: Asset[], sort: SortKey): Asset[] {
  const copy = [...assets];
  switch (sort) {
    case 'name-asc':
      return copy.sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.filename, b.filename));
    case 'name-desc':
      return copy.sort((a, b) => collator.compare(b.name, a.name) || collator.compare(b.filename, a.filename));
    case 'filename-asc':
      return copy.sort((a, b) => collator.compare(a.filename, b.filename));
    case 'size-desc':
      return copy.sort((a, b) => b.fileSize - a.fileSize || collator.compare(a.name, b.name));
    case 'size-asc':
      return copy.sort((a, b) => a.fileSize - b.fileSize || collator.compare(a.name, b.name));
    default:
      return copy;
  }
}
