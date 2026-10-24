import { describe, expect, it } from 'vitest';
import { clampDimension, fitWithin, sanitizeSvgForRender, svgIntrinsicSize, MAX_DIMENSION, MIN_DIMENSION } from '../../src/lib/convert';
import { safeZipName, uniquePath } from '../../src/lib/zip';

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
