import type { Asset, Dataset } from '../types/asset';
import { ASSET_VARIANTS, COLLECTIONS } from '../types/asset';

export type DatasetValidationIssue = {
  path: string;
  message: string;
};

const NAME_STATUSES = new Set(['documented', 'tentative']);
const QUALITY_STATUSES = new Set(['pass', 'warning', 'error']);
const INK_TONES = new Set(['dark', 'light', 'mixed']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Runtime boundary validator for the generated JSON index. TypeScript's `as
 * Dataset` only affects compilation; this function checks the shape the browser
 * actually receives before the data enters global state.
 *
 * It intentionally checks schema and cross-field invariants, not file bytes
 * (those are checked by scripts/validate-assets.mjs during build/deploy).
 */
export function validateDataset(value: unknown): { ok: true; dataset: Dataset } | { ok: false; issues: DatasetValidationIssue[] } {
  const issues: DatasetValidationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  if (!isRecord(value)) return { ok: false, issues: [{ path: '$', message: 'expected an object' }] };
  if (!Array.isArray(value.assets)) issue('assets', 'expected an array');
  if (!isRecord(value.meta)) issue('meta', 'expected an object');
  if (!Array.isArray(value.issues)) issue('issues', 'expected an array');
  if (!isRecord(value.duplicates)) issue('duplicates', 'expected an object');
  if (!Array.isArray(value.filenameConflicts)) issue('filenameConflicts', 'expected an array');

  const meta = isRecord(value.meta) ? value.meta : null;
  if (meta) {
    if (meta.schemaVersion !== 1) issue('meta.schemaVersion', 'expected supported schema version 1');
    if (!isNonEmptyString(meta.name)) issue('meta.name', 'expected a non-empty string');
    if (!isNonEmptyString(meta.description)) issue('meta.description', 'expected a non-empty string');
    if (typeof meta.generatedAt !== 'string' || !Number.isFinite(Date.parse(meta.generatedAt))) issue('meta.generatedAt', 'expected an ISO date');
    if (!isNonEmptyString(meta.generator)) issue('meta.generator', 'expected a non-empty string');
    if (!isRecord(meta.counts)) issue('meta.counts', 'expected an object');
    if (!isRecord(meta.upstream)) issue('meta.upstream', 'expected an object');
    else {
      if (typeof meta.upstream.repository !== 'string' || !/^https:\/\//.test(meta.upstream.repository)) issue('meta.upstream.repository', 'expected an https URL');
      if (!isNonEmptyString(meta.upstream.license)) issue('meta.upstream.license', 'expected a non-empty string');
      if (!isNonEmptyString(meta.upstream.readme)) issue('meta.upstream.readme', 'expected a non-empty string');
    }
    if (!isRecord(meta.npm)) issue('meta.npm', 'expected an object');
    else {
      if (!isNonEmptyString(meta.npm.package)) issue('meta.npm.package', 'expected a non-empty string');
      if (!(meta.npm.version === null || typeof meta.npm.version === 'string')) issue('meta.npm.version', 'expected string or null');
      if (typeof meta.npm.mapped !== 'number' || !Number.isSafeInteger(meta.npm.mapped) || meta.npm.mapped < 0) issue('meta.npm.mapped', 'expected a non-negative integer');
    }
    if (!isRecord(meta.quality)) issue('meta.quality', 'expected an object');
    else for (const [key, count] of Object.entries(meta.quality)) {
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) issue(`meta.quality.${key}`, 'expected a non-negative integer');
    }
    if (!isRecord(meta.unknowns) || !Object.values(meta.unknowns).every((x) => typeof x === 'string')) issue('meta.unknowns', 'expected a string-valued object');
  }

  const assets = Array.isArray(value.assets) ? value.assets : [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, raw] of assets.entries()) {
    const base = `assets[${index}]`;
    if (!isRecord(raw)) {
      issue(base, 'expected an object');
      continue;
    }
    const asset = raw as Partial<Asset>;
    if (!isNonEmptyString(asset.id)) issue(`${base}.id`, 'expected a non-empty string');
    else if (ids.has(asset.id)) issue(`${base}.id`, `duplicate id ${asset.id}`);
    else ids.add(asset.id);

    if (!isNonEmptyString(asset.name)) issue(`${base}.name`, 'expected a non-empty string');
    if (typeof asset.nameStatus !== 'string' || !NAME_STATUSES.has(asset.nameStatus)) issue(`${base}.nameStatus`, 'unexpected status');
    if (!isNonEmptyString(asset.nameSource)) issue(`${base}.nameSource`, 'expected a non-empty string');
    if (asset.nameStatus === 'documented' && typeof asset.nameSource === 'string' && !asset.nameSource.includes('upstream-readme')) issue(`${base}.nameSource`, 'documented names must identify upstream README provenance');
    if (!Array.isArray(asset.aliases) || !asset.aliases.every((x) => typeof x === 'string')) issue(`${base}.aliases`, 'expected an array of strings');
    if (!isNonEmptyString(asset.filename)) issue(`${base}.filename`, 'expected a non-empty string');
    if (!isNonEmptyString(asset.relativePath)) issue(`${base}.relativePath`, 'expected a non-empty string');
    else if (paths.has(asset.relativePath)) issue(`${base}.relativePath`, `duplicate path ${asset.relativePath}`);
    else paths.add(asset.relativePath);

    if (isNonEmptyString(asset.relativePath) && asset.publicPath !== `/${asset.relativePath}`) {
      issue(`${base}.publicPath`, 'must be a root-relative path matching relativePath');
    }
    if (asset.collection !== undefined && !COLLECTIONS.includes(asset.collection as (typeof COLLECTIONS)[number])) {
      issue(`${base}.collection`, 'unexpected collection');
    }
    if (asset.variant !== undefined && !ASSET_VARIANTS.includes(asset.variant as (typeof ASSET_VARIANTS)[number])) {
      issue(`${base}.variant`, 'unexpected variant');
    }
    if (asset.format !== 'svg') issue(`${base}.format`, 'expected svg');
    if (typeof asset.fileSize !== 'number' || !Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0) {
      issue(`${base}.fileSize`, 'expected a positive safe integer');
    }
    if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.sha256)) issue(`${base}.sha256`, 'expected a SHA-256 hex digest');
    if (!isNullableNumber(asset.width) || (typeof asset.width === 'number' && asset.width <= 0)) issue(`${base}.width`, 'expected null or a positive finite number');
    if (!isNullableNumber(asset.height) || (typeof asset.height === 'number' && asset.height <= 0)) issue(`${base}.height`, 'expected null or a positive finite number');
    if (!(asset.viewBox === null || typeof asset.viewBox === 'string')) issue(`${base}.viewBox`, 'expected string or null');
    if (!(asset.country === null || typeof asset.country === 'string')) issue(`${base}.country`, 'expected string or null');
    if (!(asset.category === null || typeof asset.category === 'string')) issue(`${base}.category`, 'expected string or null');
    if (!(asset.website === null || (typeof asset.website === 'string' && /^https?:\/\//.test(asset.website)))) issue(`${base}.website`, 'expected http(s) URL or null');

    if (!isRecord(asset.source)) issue(`${base}.source`, 'expected an object');
    else {
      if (!isNonEmptyString(asset.source.upstream)) issue(`${base}.source.upstream`, 'expected a non-empty string');
      if (!isNonEmptyString(asset.source.collection)) issue(`${base}.source.collection`, 'expected a non-empty string');
      if (!(asset.source.npmExport === null || typeof asset.source.npmExport === 'string')) issue(`${base}.source.npmExport`, 'expected string or null');
      if (!Array.isArray(asset.source.npmExports) || !asset.source.npmExports.every((x) => typeof x === 'string')) issue(`${base}.source.npmExports`, 'expected an array of strings');
      if (!(asset.source.npmPackage === null || typeof asset.source.npmPackage === 'string')) issue(`${base}.source.npmPackage`, 'expected string or null');
    }
    if (!isRecord(asset.license)) issue(`${base}.license`, 'expected an object');
    else {
      if (!isNonEmptyString(asset.license.code)) issue(`${base}.license.code`, 'expected a non-empty string');
      if (!isNonEmptyString(asset.license.scope)) issue(`${base}.license.scope`, 'expected a non-empty string');
      if (typeof asset.license.trademark !== 'string') issue(`${base}.license.trademark`, 'expected a string');
      if (!isNonEmptyString(asset.license.note)) issue(`${base}.license.note`, 'expected a non-empty string');
    }
    if (!isRecord(asset.quality)) issue(`${base}.quality`, 'expected an object');
    else {
      if (typeof asset.quality.status !== 'string' || !QUALITY_STATUSES.has(asset.quality.status)) issue(`${base}.quality.status`, 'unexpected status');
      if (typeof asset.quality.findingCount !== 'number' || !Number.isInteger(asset.quality.findingCount) || asset.quality.findingCount < 0) issue(`${base}.quality.findingCount`, 'expected a non-negative integer');
      if (!Array.isArray(asset.quality.codes) || !asset.quality.codes.every((x) => typeof x === 'string')) issue(`${base}.quality.codes`, 'expected an array of strings');
      if (typeof asset.quality.wellFormed !== 'boolean') issue(`${base}.quality.wellFormed`, 'expected a boolean');
      if (!Array.isArray(asset.quality.externalRefs) || !asset.quality.externalRefs.every((x) => typeof x === 'string')) issue(`${base}.quality.externalRefs`, 'expected an array of strings');
    }
    if (asset.ink !== undefined) {
      if (!isRecord(asset.ink)) issue(`${base}.ink`, 'expected an object');
      else {
        if (typeof asset.ink.tone !== 'string' || !INK_TONES.has(asset.ink.tone)) issue(`${base}.ink.tone`, 'unexpected tone');
        for (const key of ['luminance', 'minLuminance', 'maxLuminance']) {
          if (typeof asset.ink[key] !== 'number' || !Number.isFinite(asset.ink[key]) || asset.ink[key] < 0 || asset.ink[key] > 1) {
            issue(`${base}.ink.${key}`, 'expected a number from 0 to 1');
          }
        }
        if (typeof asset.ink.samples !== 'number' || !Number.isInteger(asset.ink.samples) || asset.ink.samples < 0) issue(`${base}.ink.samples`, 'expected a non-negative integer');
      }
    }
  }

  if (meta && isRecord(meta.counts) && Array.isArray(value.assets)) {
    const counts = meta.counts;
    if (counts.total !== assets.length) issue('meta.counts.total', 'does not match assets length');
    if (!isRecord(counts.byFormat) || counts.byFormat.svg !== assets.length || Object.values(counts.byFormat).some((x) => typeof x !== 'number' || x < 0)) issue('meta.counts.byFormat', 'does not match SVG records');
    if (!isRecord(counts.byCollection)) issue('meta.counts.byCollection', 'expected an object');
    else for (const collection of COLLECTIONS) {
      const actual = assets.filter((asset) => isRecord(asset) && asset.collection === collection).length;
      if (counts.byCollection[collection] !== actual) issue(`meta.counts.byCollection.${collection}`, 'does not match records');
    }
    if (!isRecord(counts.byVariant)) issue('meta.counts.byVariant', 'expected an object');
    else for (const variant of ASSET_VARIANTS) {
      const actual = assets.filter((asset) => isRecord(asset) && asset.variant === variant).length;
      if (counts.byVariant[variant] !== actual) issue(`meta.counts.byVariant.${variant}`, 'does not match records');
    }
    const documented = assets.filter((asset) => isRecord(asset) && asset.nameStatus === 'documented').length;
    if (counts.documentedNames !== documented) issue('meta.counts.documentedNames', 'does not match documented records');
    const totalBytes = assets.reduce((sum, asset) => sum + (isRecord(asset) && typeof asset.fileSize === 'number' ? asset.fileSize : 0), 0);
    if (counts.totalBytes !== totalBytes) issue('meta.counts.totalBytes', 'does not match fileSize sum');
  }

  if (issues.length) return { ok: false, issues: issues.slice(0, 20) };
  return { ok: true, dataset: value as unknown as Dataset };
}
