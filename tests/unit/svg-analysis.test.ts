import { describe, expect, it } from 'vitest';
import { analyzeSvg, checkWellFormed, parseViewBox, collectExternalRefs } from '../../shared/svg-analysis.mjs';

const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;

describe('checkWellFormed', () => {
  it('accepts valid markup and self-closing tags', () => {
    expect(checkWellFormed(GOOD).ok).toBe(true);
    expect(checkWellFormed('<svg><g><rect/></g></svg>').ok).toBe(true);
  });

  it('rejects unclosed and mismatched tags', () => {
    expect(checkWellFormed('<svg><g></svg>').ok).toBe(false);
    expect(checkWellFormed('<svg></g>').ok).toBe(false);
  });

  it('rejects unterminated markup', () => {
    expect(checkWellFormed('<svg><path d="M0 0').ok).toBe(false);
  });
});

describe('parseViewBox', () => {
  it('parses four numbers', () => {
    expect(parseViewBox('0 0 1024 768')).toMatchObject({ width: 1024, height: 768 });
  });

  it('rejects malformed or zero-sized boxes', () => {
    expect(parseViewBox('0 0 0 100')).toBeNull();
    expect(parseViewBox('nope')).toBeNull();
    expect(parseViewBox(undefined)).toBeNull();
  });
});

describe('collectExternalRefs', () => {
  it('finds http, protocol-relative and data references', () => {
    expect(collectExternalRefs('<image href="https://x.test/a.png"/>')).toEqual(['https://x.test/a.png']);
    expect(collectExternalRefs('<image xlink:href="//cdn.test/a.png"/>')).toEqual(['//cdn.test/a.png']);
    expect(collectExternalRefs('<style>.a{background:url("data:image/png;base64,AA")}</style>')).toHaveLength(1);
    expect(collectExternalRefs('<image href="#local"/>')).toEqual([]);
  });
});

describe('analyzeSvg', () => {
  it('passes a clean file', () => {
    const result = analyzeSvg('good.svg', GOOD);
    expect(result.status).toBe('pass');
    expect(result.viewBox?.width).toBe(24);
    expect(result.findings).toEqual([]);
  });

  it('flags an empty file as an error', () => {
    const result = analyzeSvg('empty.svg', '');
    expect(result.status).toBe('error');
    expect(result.findings[0].code).toBe('EMPTY_FILE');
  });

  it('flags script tags and event handlers', () => {
    const result = analyzeSvg('evil.svg', '<svg viewBox="0 0 1 1" onload="alert(1)"><script>alert(1)</script><path d="M0 0"/></svg>');
    expect(result.status).toBe('error');
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('SCRIPT_TAG');
    expect(codes).toContain('EVENT_HANDLER');
  });

  it('warns on a missing viewBox but does not call it an error', () => {
    const result = analyzeSvg('noview.svg', '<svg width="10" height="10"><rect width="10" height="10"/></svg>');
    expect(result.status).toBe('warning');
    expect(result.findings.map((f) => f.code)).toContain('NO_VIEWBOX');
  });

  it('reports external references without failing a clean structure', () => {
    const result = analyzeSvg('ext.svg', '<svg viewBox="0 0 10 10"><image href="https://example.com/x.png" width="10" height="10"/></svg>');
    expect(result.findings.map((f) => f.code)).toContain('EXTERNAL_REFERENCE');
    expect(result.status).toBe('warning');
  });
});
