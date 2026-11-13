import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDataset } from '../../src/lib/dataset-validation';
import type { Dataset } from '../../src/types/asset';

const root = resolve(__dirname, '../..');
const good = JSON.parse(readFileSync(resolve(root, 'public/data/assets.json'), 'utf8')) as Dataset;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('runtime dataset validation', () => {
  it('accepts the generated index and checks aggregate counts', () => {
    const result = validateDataset(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataset.assets.length).toBe(good.meta.counts.total);
  });

  it.each([null, [], 'wrong', { assets: [] }, { ...good, assets: {} }])('rejects a malformed root: %j', (input) => {
    expect(validateDataset(input).ok).toBe(false);
  });

  it('rejects duplicate ids and duplicate paths', () => {
    const broken = clone(good);
    broken.assets[1].id = broken.assets[0].id;
    broken.assets[1].relativePath = broken.assets[0].relativePath;
    const result = validateDataset(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((x) => x.path.endsWith('.id'))).toBe(true);
      expect(result.issues.some((x) => x.path.endsWith('.relativePath'))).toBe(true);
    }
  });

  it('rejects inconsistent aggregates and unsupported enum values', () => {
    const broken = clone(good);
    broken.meta.counts.total += 1;
    broken.assets[0].variant = 'unknown' as never;
    const result = validateDataset(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((x) => x.path === 'meta.counts.total')).toBe(true);
      expect(result.issues.some((x) => x.path === 'assets[0].variant')).toBe(true);
    }
  });

  it('rejects malformed nested quality, source and ink fields', () => {
    const broken = clone(good);
    (broken.assets[0] as unknown as { quality: unknown }).quality = null;
    (broken.assets[1] as unknown as { source: unknown }).source = [];
    (broken.assets[2] as unknown as { ink: unknown }).ink = { tone: 'neon' };
    expect(validateDataset(broken).ok).toBe(false);
  });
});
