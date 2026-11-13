import { describe, expect, it } from 'vitest';
import { clampDimensions, MAX_CANVAS_PIXELS, MAX_DIMENSION, MIN_DIMENSION } from '../../src/lib/convert';
import { safeZipName } from '../../src/lib/zip';

describe('pixel budget', () => {
  it('clamps 4096-square request to the pixel budget', () => {
    const out = clampDimensions(4096, 4096);
    expect(out.width * out.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(out.width).toBeLessThanOrEqual(MAX_DIMENSION);
    expect(out.height).toBeLessThanOrEqual(MAX_DIMENSION);
    expect(out.width).toBeGreaterThanOrEqual(MIN_DIMENSION);
    expect(out.height).toBeGreaterThanOrEqual(MIN_DIMENSION);
  });

  it('preserves requested aspect ratio within integer-rounding tolerance', () => {
    const out = clampDimensions(4096, 2048);
    expect(out.width / out.height).toBeCloseTo(2, 2);
    expect(out.width * out.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it('normalizes non-finite dimensions and bounds each axis', () => {
    expect(clampDimensions(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ width: 512, height: 512 });
    expect(clampDimensions(1, 1)).toEqual({ width: MIN_DIMENSION, height: MIN_DIMENSION });
  });
});

describe('safe zip paths', () => {
  it('strips traversal-like and reserved path characters', () => {
    for (const candidate of ['../../x', '..\\..\\x', 'C:\\evil.svg', '/absolute.svg']) {
      const cleaned = safeZipName(candidate);
      expect(cleaned).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
      expect(cleaned.startsWith('.')).toBe(false);
    }
  });

  it('caps names to the documented length', () => {
    expect(safeZipName('x'.repeat(500))).toHaveLength(120);
  });
});
