import { describe, expect, it } from 'vitest';
import { analyzeInkTone } from '../../shared/svg-analysis.mjs';

/**
 * Ink tone is the hint that keeps dark artwork visible in dark mode. It must be
 * derived from declared fill colours only — never from a guess about the bank.
 */
describe('analyzeInkTone', () => {
  it('detects an all-black mark as dark ink', () => {
    const ink = analyzeInkTone('<svg viewBox="0 0 10 10"><path fill="#000000" d="M0 0h10v10H0z"/></svg>');
    expect(ink.tone).toBe('dark');
    expect(ink.luminance).toBeLessThan(0.05);
  });

  it('detects an all-white badge as light ink', () => {
    const ink = analyzeInkTone(
      '<svg viewBox="0 0 10 10"><rect fill="#FFFFFF" width="10" height="10"/><path fill="white" d="M2 2h6v6H2z"/></svg>',
    );
    expect(ink.tone).toBe('light');
    expect(ink.luminance).toBeGreaterThan(0.9);
  });

  it('treats a missing fill as the SVG default black', () => {
    const ink = analyzeInkTone('<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>');
    expect(ink.tone).toBe('dark');
    expect(ink.samples).toBe(1);
  });

  it('classifies a colourful mark as mixed', () => {
    const ink = analyzeInkTone(
      '<svg viewBox="0 0 10 10"><path fill="#0a7f3f" d="M0 0h5v5H0z"/><path fill="#f2c200" d="M5 5h5v5H5z"/></svg>',
    );
    expect(ink.tone).toBe('mixed');
  });

  it('ignores non-colour fills (url references, CSS variables)', () => {
    const ink = analyzeInkTone(
      '<svg viewBox="0 0 10 10"><path fill="url(#g)" d="M0 0"/><path fill="currentColor" d="M0 0"/><rect fill="#111" width="1" height="1"/></svg>',
    );
    expect(ink.samples).toBe(1);
    expect(ink.tone).toBe('dark');
  });

  it('parses shorthand hex, rgb() and style-block fills', () => {
    expect(analyzeInkTone('<svg><path fill="#fff" d="M0 0"/></svg>').tone).toBe('light');
    expect(analyzeInkTone('<svg><path fill="rgb(10,10,10)" d="M0 0"/></svg>').tone).toBe('dark');
    expect(analyzeInkTone('<svg><style>.a{fill:#000000}</style><path class="a" d="M0 0"/></svg>').tone).toBe('dark');
  });

  it('is exposed per asset in the generated index', async () => {
    const dataset = (await import('../../public/data/assets.json')).default as {
      assets: { ink?: { tone: string } }[];
    };
    const withInk = dataset.assets.filter((asset) => asset.ink && asset.ink.tone !== 'mixed');
    expect(withInk.length).toBeGreaterThan(100);
    for (const asset of dataset.assets) {
      expect(asset.ink, 'every asset carries an ink hint').toBeDefined();
      expect(['dark', 'light', 'mixed']).toContain(asset.ink?.tone);
    }
  });
});
