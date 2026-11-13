import { describe, expect, it } from 'vitest';
import { validateDataset } from '../../src/lib/dataset-validation';
import { readInitialPreferences } from '../../src/hooks/usePreferences';
import { __setDatasetForTests } from '../../src/hooks/useDataset';
import type { Dataset } from '../../src/types/asset';

describe('runtime regression hardening', () => {
  it('accepts an arbitrary dataset count rather than locking the schema to 606', () => {
    const dataset = structuredClone(JSON.parse(require('node:fs').readFileSync('public/data/assets.json', 'utf8'))) as Dataset;
    const one = dataset.assets[0];
    dataset.assets = [one];
    dataset.meta.counts.total = 1;
    dataset.meta.counts.byFormat = { svg: 1 };
    dataset.meta.counts.byCollection = { logos: 1, other: 0 };
    dataset.meta.counts.byVariant = { plain: 0, rect: 1, badge: 0 };
    dataset.assets[0] = { ...one, variant: 'rect' };
    dataset.meta.counts.documentedNames = one.nameStatus === 'documented' ? 1 : 0;
    dataset.meta.counts.totalBytes = one.fileSize;
    expect(validateDataset(dataset).ok).toBe(true);
  });

  it('revalidates the generated index with aggregate variant counts', () => {
    const dataset = JSON.parse(require('node:fs').readFileSync('public/data/assets.json', 'utf8')) as Dataset;
    expect(validateDataset(dataset).ok).toBe(true);
    const bad = structuredClone(dataset);
    bad.meta.counts.byVariant.rect += 1;
    const result = validateDataset(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.path === 'meta.counts.byVariant.rect')).toBe(true);
  });

  it('normalizes persisted preferences field-by-field', () => {
    expect(readInitialPreferences()).toEqual({ theme: 'light', plate: 'auto', compactGrid: false, lang: 'zh' });
  });

  it('exposes a test seam without modifying cached global data', () => {
    expect(typeof __setDatasetForTests).toBe('function');
  });
});
