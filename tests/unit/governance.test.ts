import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
/** JSX wraps copy across lines; collapse whitespace before asserting on prose. */
const prose = (path: string) => read(path).replace(/\s+/g, ' ');

describe('project governance files', () => {
  it('keeps the upstream MIT licence text intact', () => {
    const licence = read('LICENSE');
    expect(licence).toContain('MIT License');
    expect(licence).toContain('Copyright (c) 2022 IconGo');
    expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it('ships no npm publish configuration or credentials', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.private).toBe(true);
    expect(pkg.name).toBe('bancora');
    expect(pkg.publishConfig).toBeUndefined();
    const text = read('README.md') + read('docs/DEVELOPMENT.md');
    expect(text).toMatch(/@icongo\/bl/);
  });

  it('does not claim affiliation with any bank', () => {
    const footer = prose('src/components/Footer.tsx');
    expect(footer).toContain('not affiliated with or endorsed by');
    expect(footer).toContain('trademarks remain the property of their respective owners');
    expect(footer.toLowerCase()).not.toContain('partner of');
  });

  it('documents the trademark position on the about page', () => {
    const about = prose('src/pages/AboutPage.tsx');
    expect(about).toContain('Trademarks are separate');
    expect(about).toContain('not affiliated with or endorsed by');
  });

  it('never hard-codes a statistics figure in the hero', () => {
    const stats = read('src/components/StatsBar.tsx');
    expect(stats).toContain('meta.counts.total');
    expect(stats).not.toMatch(/['"`]606['"`]/);
    expect(stats).not.toMatch(/['"`]422['"`]/);
  });

  it('keeps the legacy npm package untouched', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(JSON.stringify(pkg.dependencies)).not.toContain('@icongo/bl');
    expect(pkg.name).not.toContain('icongo');
  });
});
