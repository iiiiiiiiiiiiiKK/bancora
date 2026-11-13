import { describe, expect, it } from 'vitest';
import { clampDimension, clampDimensions, fitWithin, sanitizeSvgForRender, svgIntrinsicSize, MAX_DIMENSION, MIN_DIMENSION, MAX_CANVAS_PIXELS } from '../../src/lib/convert';
import { safeZipName, uniquePath } from '../../src/lib/zip';
import { convertBatchToZip } from '../../src/lib/convert';
import { readZipDirectory, readZipEntry } from './zip-reader';
import { beforeEach, afterEach, vi } from 'vitest';

describe('fitWithin', () => {
  it('preserves aspect ratio and centres the artwork', () => {
    const fit = fitWithin({ width: 1024, height: 512 }, { width: 400, height: 400 });
    expect(fit.drawWidth).toBe(400);
    expect(fit.drawHeight).toBe(200);
    expect(fit.offsetY).toBe(100);
    expect(fit.offsetX).toBe(0);
  });

  it('letterboxes a tall logo', () => {
    const fit = fitWithin({ width: 512, height: 1024 }, { width: 300, height: 300 });
    expect(fit.drawHeight).toBe(300);
    expect(fit.drawWidth).toBe(150);
    expect(fit.offsetX).toBe(75);
  });
});

describe('clampDimensions', () => {
  it('bounds total canvas area as well as each side', () => {
    const result = clampDimensions(4096, 4096);
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(result.width).toBe(4096);
    expect(result.height).toBe(4096);
    const rectangle = clampDimensions(4096, 2048);
    expect(rectangle.width * rectangle.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(rectangle.width / rectangle.height).toBeCloseTo(2, 2);
  });
});

describe('clampDimension', () => {
  it('clamps to the supported range', () => {
    expect(clampDimension(1)).toBe(MIN_DIMENSION);
    expect(clampDimension(99999)).toBe(MAX_DIMENSION);
    expect(clampDimension(512.4)).toBe(512);
    expect(clampDimension(Number.NaN)).toBe(512);
  });
});

describe('svgIntrinsicSize', () => {
  it('prefers the viewBox', () => {
    expect(svgIntrinsicSize('<svg viewBox="0 0 120 60" width="10" height="10"/>')).toEqual({ width: 120, height: 60 });
  });

  it('falls back to width/height, then 1024', () => {
    expect(svgIntrinsicSize('<svg width="32" height="16"/>')).toEqual({ width: 32, height: 16 });
    expect(svgIntrinsicSize('<svg>')).toEqual({ width: 1024, height: 1024 });
  });
});

describe('sanitizeSvgForRender', () => {
  it('removes scripts, event handlers and external references', () => {
    const dirty =
      '<svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><image href="https://evil.test/a.png"/><path d="M0 0"/></svg>';
    const clean = sanitizeSvgForRender(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onload/i);
    expect(clean).not.toMatch(/evil\.test/);
    expect(clean).toMatch(/<path/);
  });

  it('keeps data URIs and internal references', () => {
    const source = '<svg viewBox="0 0 10 10"><image href="data:image/png;base64,AA"/><use href="#a"/></svg>';
    const clean = sanitizeSvgForRender(source);
    expect(clean).toContain('data:image/png');
    expect(clean).toContain('#a');
  });

  it('adds a viewBox when missing', () => {
    expect(sanitizeSvgForRender('<svg><path d="M0 0"/></svg>')).toContain('viewBox="0 0 1024 1024"');
  });

  it('throws for non-SVG input', () => {
    expect(() => sanitizeSvgForRender('<html></html>')).toThrow();
  });
});

describe('zip helpers', () => {
  it('sanitises unsafe file names', () => {
    expect(safeZipName('a/b\\c:d?.svg')).toBe('a-b-c-d-.svg');
    expect(safeZipName('   ')).toBe('logo');
  });

  it('never emits duplicate paths', () => {
    const used = new Set<string>();
    expect(uniquePath(used, 'logo', '.svg')).toBe('logo.svg');
    expect(uniquePath(used, 'logo', '.svg')).toBe('logo-2.svg');
    expect(uniquePath(used, 'logo', '.svg')).toBe('logo-3.svg');
  });
});


describe('batch conversion archive cancellation', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    class MockImage { decoding = 'async'; onload: (() => void) | null = null; onerror: (() => void) | null = null; src = ''; width = 1; height = 1; set srcValue(value: string) { this.src = value; } }
    vi.stubGlobal('Image', class extends MockImage { constructor() { super(); queueMicrotask(() => this.onload?.()); } });
    vi.stubGlobal('document', { createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: vi.fn(), clearRect: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'high', drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' })) };
      return canvas;
    } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('emits a complete ZIP and preserves the requested format', async () => {
    const item = { id: 'logos/sample', name: 'Sample', source: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>' };
    const options = { width: 32, height: 32, format: 'png' as const, background: 'transparent' as const };
    const result = await convertBatchToZip([item], options);
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(result.blob);
    });
    const listing = readZipDirectory(bytes).map((entry) => entry.path);
    expect(listing).toContain('logos-sample.png');
    expect(listing).toContain('conversion.json');
    const manifest = JSON.parse((await readZipEntry(bytes, 'conversion.json'))!);
    expect(manifest.format).toBe('png');
    expect(manifest.files).toHaveLength(1);
  });

  it('aborts ZIP compression and clears stream accumulation', async () => {
    const controller = new AbortController();
    const item = { id: 'logos/sample', name: 'Sample', source: '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>' };
    const work = convertBatchToZip([item], { width: 32, height: 32, format: 'png', background: 'transparent', signal: controller.signal });
    controller.abort();
    await expect(work).rejects.toMatchObject({ name: 'AbortError' });
  });
});
