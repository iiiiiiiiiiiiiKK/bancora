import { describe, expect, it } from 'vitest';
import { normalize, buildSearchIndex, matchesQuery, sortAssets } from '../../src/lib/search';
import type { Asset } from '../../src/types/asset';

function asset(partial: Partial<Asset> & { id: string; name: string; filename: string }): Asset {
  return {
    nameStatus: 'documented',
    nameSource: 'test',
    aliases: [],
    relativePath: `logos/${partial.filename}`,
    publicPath: `/logos/${partial.filename}`,
    collection: 'logos',
    variant: 'plain',
    format: 'svg',
    fileSize: 1000,
    sha256: 'x',
    viewBox: '0 0 1024 1024',
    width: 1024,
    height: 1024,
    country: null,
    category: null,
    website: null,
    source: { upstream: 'u', collection: 'logos', npmExport: null, npmExports: [], npmPackage: null },
    license: { code: 'MIT', scope: 's', trademark: 'unknown', note: 'n' },
    quality: { status: 'pass', findingCount: 0, codes: [], wellFormed: true, externalRefs: [] },
    ...partial,
  };
}

const assets: Asset[] = [
  asset({ id: 'logos/abchina', name: '中国农业银行', filename: 'abchina.svg', fileSize: 25784 }),
  asset({ id: 'logos/abchina-rect', name: '中国农业银行', filename: 'abchina-rect.svg', variant: 'rect', fileSize: 2667 }),
  asset({ id: 'logos/hsbc', name: '汇丰银行', filename: 'hsbc.svg', fileSize: 5661, aliases: ['HSBC'] }),
  asset({ id: 'other/三井住友银行', name: '三井住友银行', filename: '三井住友银行.svg', collection: 'other', variant: 'badge', fileSize: 3869 }),
];

describe('normalize', () => {
  it('lowercases, collapses whitespace and strips punctuation', () => {
    expect(normalize('  Bank   of—China ')).toBe('bank of china');
    expect(normalize('ＡＢＣ')).toBe('abc');
  });
});

describe('search', () => {
  const index = buildSearchIndex(assets);

  it('matches by name, file name, id and alias', () => {
    expect(index.filter((e) => matchesQuery(e, '农业银行')).length).toBe(2);
    expect(index.filter((e) => matchesQuery(e, 'hsbc')).length).toBe(1);
    expect(index.filter((e) => matchesQuery(e, 'ABCHINA-RECT')).length).toBe(1);
    expect(index.filter((e) => matchesQuery(e, 'other/三井')).length).toBe(1);
  });

  it('is punctuation and whitespace tolerant', () => {
    expect(index.filter((e) => matchesQuery(e, 'bank-of china')).length).toBe(0); // no English name in this fixture
    expect(index.filter((e) => matchesQuery(e, '  hsbc  ')).length).toBe(1);
  });

  it('requires every token to match', () => {
    expect(index.filter((e) => matchesQuery(e, 'hsbc missing')).length).toBe(0);
  });

  it('returns everything for an empty query', () => {
    expect(index.filter((e) => matchesQuery(e, '   ')).length).toBe(assets.length);
  });
});

describe('sortAssets', () => {
  it('sorts by name in both directions without mutating the input', () => {
    const copy = [...assets];
    const asc = sortAssets(assets, 'name-asc');
    const desc = sortAssets(assets, 'name-desc');
    expect(assets).toEqual(copy);
    expect(asc.map((a) => a.name)).toEqual([...asc.map((a) => a.name)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')));
    expect(desc[0].name).toBe(asc[asc.length - 1].name);
  });

  it('sorts by size', () => {
    expect(sortAssets(assets, 'size-desc').map((a) => a.fileSize)).toEqual([25784, 5661, 3869, 2667]);
    expect(sortAssets(assets, 'size-asc').map((a) => a.fileSize)).toEqual([2667, 3869, 5661, 25784]);
  });

  it('sorts by file name', () => {
    const names = sortAssets(assets, 'filename-asc').map((a) => a.filename);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
