import { describe, expect, it } from 'vitest';
import { htmlSnippet, reactSnippet, cssSnippet, assetJson, displaySize, withBase } from '../../src/lib/paths';
import type { Asset } from '../../src/types/asset';

const sample: Asset = {
  id: 'logos/abchina-rect',
  name: '中国农业银行',
  nameStatus: 'documented',
  nameSource: 'upstream-readme',
  aliases: [],
  filename: 'abchina-rect.svg',
  relativePath: 'logos/abchina-rect.svg',
  publicPath: '/logos/abchina-rect.svg',
  collection: 'logos',
  variant: 'rect',
  format: 'svg',
  fileSize: 2667,
  sha256: 'abc',
  viewBox: '0 0 1024 1024',
  width: 1024,
  height: 1024,
  country: null,
  category: null,
  website: 'https://www.abchina.com',
  source: { upstream: 'https://github.com/icongo/bank-logos', collection: 'logos', npmExport: 'BLAbchinaRect', npmExports: ['BLAbchinaRect'], npmPackage: '@icongo/bl@1.2.0' },
  license: { code: 'MIT', scope: 's', trademark: 'unknown', note: 'n' },
  quality: { status: 'pass', findingCount: 0, codes: [], wellFormed: true, externalRefs: [] },
};

describe('displaySize', () => {
  it('fits inside the box without stretching', () => {
    expect(displaySize({ ...sample, width: 1024, height: 512 }, 240)).toEqual({ width: 240, height: 120 });
  });
});

describe('code snippets', () => {
  it('reference the real public path and escaped alt text', () => {
    const html = htmlSnippet(sample);
    expect(html).toContain('src="/logos/abchina-rect.svg"');
    expect(html).toContain('alt="中国农业银行"');
    expect(html).toContain('width="240"');
    expect(html).toContain('height="240"');
  });

  it('escape quotes in alt text', () => {
    expect(htmlSnippet({ ...sample, name: 'A "quoted" bank' })).toContain('alt="A \'quoted\' bank"');
  });

  it('produce valid React with the npm export name', () => {
    const react = reactSnippet(sample);
    expect(react).toContain('export function BLAbchinaRect');
    expect(react).toContain('width={240}');
    expect(react).toContain('{...props}');
  });

  it('produce CSS with the asset URL', () => {
    expect(cssSnippet(sample)).toContain('url("/logos/abchina-rect.svg")');
  });

  it('serialise metadata without inventing unknown fields', () => {
    const json = JSON.parse(assetJson(sample));
    expect(json.country).toBeNull();
    expect(json.category).toBeNull();
    expect(json.license.trademark).toBe('unknown');
    expect(json.id).toBe('logos/abchina-rect');
  });
});

describe('withBase', () => {
  it('joins paths with the deployment base', () => {
    expect(withBase('/logos/a.svg')).toBe('/logos/a.svg');
  });
});
