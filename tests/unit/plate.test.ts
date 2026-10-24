import { describe, expect, it } from 'vitest';
import { resolvePlate, plateWasAdjusted } from '../../src/lib/plate';
import { translate } from '../../src/lib/i18n';

const dark = { tone: 'dark' as const, luminance: 0.1, minLuminance: 0.1, maxLuminance: 0.1, samples: 2 };
const light = { tone: 'light' as const, luminance: 0.95, minLuminance: 0.95, maxLuminance: 0.95, samples: 2 };
const mixed = { tone: 'mixed' as const, luminance: 0.5, minLuminance: 0.1, maxLuminance: 0.9, samples: 3 };

describe('resolvePlate', () => {
  it('puts dark artwork on a light plate in dark mode', () => {
    expect(resolvePlate({ ink: dark }, 'auto', 'dark')).toBe('light');
  });

  it('puts light artwork on a dark plate in light mode', () => {
    expect(resolvePlate({ ink: light }, 'auto', 'light')).toBe('dark');
  });

  it('follows the theme for colourful (mixed) artwork', () => {
    expect(resolvePlate({ ink: mixed }, 'auto', 'dark')).toBe('dark');
    expect(resolvePlate({ ink: mixed }, 'auto', 'light')).toBe('light');
  });

  it('respects an explicit user choice', () => {
    expect(resolvePlate({ ink: dark }, 'dark', 'light')).toBe('dark');
    expect(resolvePlate({ ink: light }, 'grid', 'dark')).toBe('grid');
  });

  it('falls back to the theme when no ink hint exists', () => {
    expect(resolvePlate(null, 'auto', 'dark')).toBe('dark');
    expect(resolvePlate({}, 'auto', 'light')).toBe('light');
  });
});

describe('plateWasAdjusted', () => {
  it('reports the two visibility saving cases only', () => {
    expect(plateWasAdjusted({ ink: dark } as never, 'dark')).toBe(true);
    expect(plateWasAdjusted({ ink: light } as never, 'light')).toBe(true);
    expect(plateWasAdjusted({ ink: mixed } as never, 'dark')).toBe(false);
    expect(plateWasAdjusted(null, 'dark')).toBe(false);
  });
});

describe('i18n', () => {
  it('returns Chinese copy by default', () => {
    expect(translate('zh', 'nav.explore')).toBe('素材库');
    expect(translate('zh', 'filters.favorites')).toBe('仅收藏');
  });

  it('returns English copy when switched', () => {
    expect(translate('en', 'nav.explore')).toBe('Explore');
    expect(translate('en', 'basket.download')).toBe('Download ZIP');
  });

  it('never returns an empty string', () => {
    const keys = ['nav.explore', 'hero.basket', 'detail.copyUrl', 'inspect.run', 'convert.download'] as const;
    for (const key of keys) {
      expect(translate('zh', key).length).toBeGreaterThan(0);
      expect(translate('en', key).length).toBeGreaterThan(0);
    }
  });
});
