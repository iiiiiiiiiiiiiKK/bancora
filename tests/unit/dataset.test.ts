/**
 * Data-integrity tests over the generated index. These run against the real
 * checkout, so a stale index or a missing file fails the suite.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyzeSvg } from '../../shared/svg-analysis.mjs';
import type { Dataset } from '../../src/types/asset';

const root = resolve(__dirname, '../..');
const dataset: Dataset = JSON.parse(readFileSync(join(root, 'public/data/assets.json'), 'utf8'));
const audit = JSON.parse(readFileSync(join(root, 'public/data/audit.json'), 'utf8'));

describe('generated asset index', () => {
  it('indexes every SVG on disk', () => {
    const indexed = new Set(dataset.assets.map((asset) => asset.relativePath));
    let onDisk = 0;
    for (const collection of ['logos', 'other']) {
      for (const file of readdirSync(join(root, 'public', collection))) {
        if (!file.toLowerCase().endsWith('.svg')) continue;
        onDisk += 1;
        expect(indexed.has(`${collection}/${file}`), `unindexed file ${collection}/${file}`).toBe(true);
      }
    }
    expect(dataset.assets.length).toBe(onDisk);
    expect(onDisk).toBe(606);
  });

  it('has unique, stable ids and valid public paths', () => {
    const ids = dataset.assets.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const asset of dataset.assets) {
      expect(asset.id).toBe(`${asset.collection}/${asset.filename.replace(/\.svg$/i, '')}`);
      expect(asset.publicPath).toBe(`/${asset.relativePath}`);
      expect(existsSync(join(root, 'public', asset.relativePath))).toBe(true);
    }
  });

  it('records accurate file sizes and formats', () => {
    for (const asset of dataset.assets) {
      const size = readFileSync(join(root, 'public', asset.relativePath)).byteLength;
      expect(size, asset.id).toBe(asset.fileSize);
      expect(size).toBeGreaterThan(0);
      expect(asset.format).toBe('svg');
      expect(asset.filename.endsWith('.svg')).toBe(true);
    }
  });

  it('never invents country, category, SWIFT or trademark data', () => {
    for (const asset of dataset.assets) {
      expect(asset.country).toBeNull();
      expect(asset.category).toBeNull();
      expect(asset.license.trademark).toBe('unknown');
      expect(JSON.stringify(asset)).not.toMatch(/swift|bic/i);
    }
  });

  it('labels every tentative name', () => {
    const tentative = dataset.assets.filter((asset) => asset.nameStatus === 'tentative');
    expect(tentative.length).toBe(184);
    for (const asset of tentative) {
      expect(asset.name.length).toBeGreaterThan(0);
      expect(asset.source.npmExport).toBeNull();
    }
    for (const asset of dataset.assets.filter((a) => a.nameStatus === 'documented')) {
      expect(asset.nameSource).toContain('upstream-readme');
    }
  });

  it('stores a quality status that matches a fresh analysis', () => {
    for (const asset of dataset.assets) {
      const source = readFileSync(join(root, 'public', asset.relativePath), 'utf8');
      expect(analyzeSvg(asset.relativePath, source).status, asset.id).toBe(asset.quality.status);
    }
  });

  it('keeps meta counts consistent with the records', () => {
    expect(dataset.meta.counts.total).toBe(dataset.assets.length);
    expect(dataset.meta.counts.byFormat.svg).toBe(dataset.assets.length);
    expect(dataset.meta.counts.byCollection.logos).toBe(dataset.assets.filter((a) => a.collection === 'logos').length);
    expect(dataset.meta.counts.byCollection.other).toBe(dataset.assets.filter((a) => a.collection === 'other').length);
    expect(dataset.meta.counts.documentedNames).toBe(dataset.assets.filter((a) => a.nameStatus === 'documented').length);
    expect(dataset.meta.counts.totalBytes).toBe(dataset.assets.reduce((sum, a) => sum + a.fileSize, 0));
    expect(dataset.meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reports duplicate groups in the audit file', () => {
    expect(audit.meta.counts.total).toBe(606);
    expect(Array.isArray(audit.duplicates.exact)).toBe(true);
    expect(audit.duplicates.exact.length).toBe(3);
    for (const group of audit.duplicates.exact) {
      const contents = group.ids.map((id: string) => {
        const asset = dataset.assets.find((a) => a.id === id)!;
        return readFileSync(join(root, 'public', asset.relativePath), 'utf8');
      });
      expect(new Set(contents).size).toBe(1);
    }
  });
});

describe('published data files', () => {
  it('serves the same index to the application', () => {
    const served = JSON.parse(readFileSync(join(root, 'public/data/assets.json'), 'utf8'));
    expect(served.assets.length).toBe(dataset.assets.length);
  });

  it('ships a licence file matching the upstream MIT text', () => {
    const license = readFileSync(join(root, 'public/LICENSE.txt'), 'utf8');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2022 IconGo');
  });
});
