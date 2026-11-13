import { describe, expect, it } from 'vitest';
import { normalizePreferences, DEFAULT_PREFERENCES } from '../../src/lib/preferences';

describe('normalizePreferences', () => {
  it('uses the theme-init DOM theme when there is no stored preference', () => {
    expect(normalizePreferences({}, 'dark')).toEqual({ ...DEFAULT_PREFERENCES, theme: 'dark' });
  });

  it('prefers an explicit valid stored theme over the DOM fallback', () => {
    expect(normalizePreferences({ theme: 'light' }, 'dark').theme).toBe('light');
  });

  it('repairs invalid stored enum and primitive values field-by-field', () => {
    expect(normalizePreferences({ theme: 'neon', plate: 'rainbow', compactGrid: 'yes', lang: 'fr' })).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects arrays and primitive roots', () => {
    expect(normalizePreferences([], 'dark')).toEqual({ ...DEFAULT_PREFERENCES, theme: 'dark' });
    expect(normalizePreferences('dark')).toEqual(DEFAULT_PREFERENCES);
  });
});
