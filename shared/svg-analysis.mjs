/**
 * Shared SVG structural analysis used by both the build-time audit scripts and
 * the browser Inspector page. This module never evaluates SVG content: it only
 * reads text and reports structural facts.
 *
 * Severity model
 *  - error   : the file is broken or unsafe to ship as-is
 *  - warning : needs a human look, may be legitimate
 *  - info    : observable fact, not a defect
 */

export const SEVERITIES = ['error', 'warning', 'info'];

const RENDERABLE = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use'];
const KNOWN_ROOT_HEAD = /^<\?xml[\s\S]*?\?>\s*/;

/**
 * Tokenise XML tags without evaluating anything. Returns null for the first
 * structural problem it finds (unbalanced or mismatched tags, unterminated
 * markup, stray text outside the root element).
 * @param {string} source
 */
export function tokenize(source) {
  /** @type {{name: string, attrs: string, closing: boolean, selfClosing: boolean, start: number, end: number}[]} */
  const tags = [];
  let i = 0;
  let rootSeen = false;
  let rootClosed = false;

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) break;
    if (lt > i) {
      const text = source.slice(i, lt);
      if (rootSeen && !rootClosed && text.trim() !== '') {
        // character data directly inside the root is allowed
      } else if (!rootSeen && text.trim() !== '') {
        return { ok: false, error: 'Text before the root element', tags };
      }
    }
    if (source.startsWith('<!--', lt)) {
      const close = source.indexOf('-->', lt + 4);
      if (close === -1) return { ok: false, error: 'Unterminated comment', tags };
      i = close + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', lt)) {
      const close = source.indexOf(']]>', lt + 9);
      if (close === -1) return { ok: false, error: 'Unterminated CDATA section', tags };
      i = close + 3;
      continue;
    }
    if (source.startsWith('<?', lt)) {
      const close = source.indexOf('?>', lt + 2);
      if (close === -1) return { ok: false, error: 'Unterminated processing instruction', tags };
      i = close + 2;
      continue;
    }
    if (source.startsWith('<!', lt)) {
      // DOCTYPE and other declarations: skip to the matching '>' (no nested quotes)
      let j = lt + 2;
      let quote = '';
      for (; j < source.length; j += 1) {
        const ch = source[j];
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') break;
      }
      if (j >= source.length) return { ok: false, error: 'Unterminated declaration', tags };
      i = j + 1;
      continue;
    }

    // regular start or end tag
    let j = lt + 1;
    let quote = '';
    for (; j < source.length; j += 1) {
      const ch = source[j];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') break;
    }
    if (j >= source.length) return { ok: false, error: 'Unterminated tag', tags };
    const raw = source.slice(lt, j + 1);
    const closing = raw.startsWith('</');
    const selfClosing = /\/>$/.test(raw);
    const body = raw.slice(closing ? 2 : 1, raw.length - 1).replace(/\/$/, '');
    const nameMatch = /^([A-Za-z_][\w:.-]*)/.exec(body.trim());
    if (!nameMatch) return { ok: false, error: `Malformed tag near ${raw.slice(0, 40)}`, tags };
    const name = nameMatch[1];
    const attrs = body.trim().slice(name.length);
    tags.push({ name, attrs, closing, selfClosing, start: lt, end: j + 1 });
    if (!closing && !rootSeen) rootSeen = true;
    i = j + 1;

    // For the root-closed tracking we need a stack; done below.
    void rootClosed;
  }

  return { ok: true, tags };
}

/**
 * @param {string} source
 * @returns {{ok: boolean, error?: string}}
 */
export function checkWellFormed(source) {
  const tokenized = tokenize(source);
  if (!tokenized.ok) return { ok: false, error: tokenized.error };
  /** @type {string[]} */
  const stack = [];
  const VOID = new Set(['br', 'img', 'meta', 'link', 'input', 'hr']);
  for (const tag of tokenized.tags) {
    if (tag.closing) {
      const expected = stack.pop();
      if (expected !== tag.name) {
        return {
          ok: false,
          error: expected
            ? `Closing tag </${tag.name}> does not match <${expected}>`
            : `Unexpected closing tag </${tag.name}>`,
        };
      }
    } else if (!tag.selfClosing && !VOID.has(tag.name.toLowerCase())) {
      stack.push(tag.name);
    }
  }
  if (stack.length > 0) return { ok: false, error: `Unclosed tag <${stack[stack.length - 1]}>` };
  return { ok: true };
}

/**
 * @param {string} attrs
 * @returns {Record<string, string>}
 */
export function parseAttributes(attrs) {
  /** @type {Record<string, string>} */
  const out = {};
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = re.exec(attrs))) out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

/**
 * Attributes that are present but not written as name="value".
 * @param {string} attrs
 */
export function findUnquotedAttributes(attrs) {
  const stripped = attrs.replace(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"[^"]*"|'[^']*')/g, '').trim();
  return stripped.length > 0;
}

/**
 * @param {string | undefined} value
 * @returns {number | null}
 */
function toNumber(value) {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a viewBox string into numeric parts.
 * @param {string | undefined} value
 */
export function parseViewBox(value) {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { minX, minY, width, height, raw: value.trim() };
}

/**
 * Analyzes a single SVG document.
 * @param {string} fileName display name, e.g. `logos/abchina.svg`
 * @param {string} source raw UTF-8 text
 * @param {{maxBytes?: number}} [options]
 */
export function analyzeSvg(fileName, source, options = {}) {
  const maxBytes = options.maxBytes ?? 400_000;
  const bytes = byteLength(source);
  /** @type {{code: string, severity: 'error'|'warning'|'info', message: string}[]} */
  const findings = [];
  const add = (code, severity, message) => findings.push({ code, severity, message });

  if (bytes === 0 || source.trim() === '') {
    add('EMPTY_FILE', 'error', 'File is empty.');
    return summarize(fileName, bytes, findings, {});
  }

  const head = source.replace(KNOWN_ROOT_HEAD, '').trimStart();
  if (!/^<svg[\s>/]/i.test(head)) add('NO_SVG_ROOT', 'error', 'Does not start with an <svg> root element.');

  const tokenized = tokenize(source);
  if (!tokenized.ok) add('PARSE_ERROR', 'error', `XML is not well-formed: ${tokenized.error}`);
  const wellFormed = checkWellFormed(source);
  if (tokenized.ok && !wellFormed.ok) add('PARSE_ERROR', 'error', `XML is not well-formed: ${wellFormed.error}`);

  const tags = tokenized.ok ? tokenized.tags : [];
  const rootTag = tags.find((t) => !t.closing && t.name.toLowerCase() === 'svg');
  const rootAttrs = rootTag ? parseAttributes(rootTag.attrs) : {};
  if (rootTag && findUnquotedAttributes(rootTag.attrs)) add('MALFORMED_ATTRIBUTE', 'error', 'Root <svg> contains an attribute without a quoted value.');

  const viewBox = parseViewBox(rootAttrs.viewbox);
  if (!rootAttrs.viewbox) {
    add('NO_VIEWBOX', 'warning', 'Root <svg> has no viewBox; scaling in <img> and canvas may be inconsistent.');
  } else if (!viewBox) {
    add('INVALID_VIEWBOX', 'error', `viewBox="${rootAttrs.viewbox}" is not valid (expected four numbers with positive width/height).`);
  }

  const width = toNumber(rootAttrs.width);
  const height = toNumber(rootAttrs.height);
  if (rootAttrs.width && width === null) add('INVALID_DIMENSION', 'warning', `width="${rootAttrs.width}" is not a plain number.`);
  if (rootAttrs.height && height === null) add('INVALID_DIMENSION', 'warning', `height="${rootAttrs.height}" is not a plain number.`);

  if (viewBox && width && height) {
    const fileRatio = viewBox.width / viewBox.height;
    const declaredRatio = width / height;
    if (Math.abs(fileRatio - declaredRatio) / fileRatio > 0.02) {
      add(
        'ASPECT_MISMATCH',
        'warning',
        `Declared width/height ratio (${declaredRatio.toFixed(3)}) differs from viewBox ratio (${fileRatio.toFixed(3)}).`,
      );
    }
  }

  if (bytes > maxBytes) {
    add('LARGE_FILE', 'warning', `File is ${formatBytes(bytes)}, above the ${formatBytes(maxBytes)} review threshold.`);
  }

  // ---- security surface -------------------------------------------------
  if (/<script\b/i.test(source)) add('SCRIPT_TAG', 'error', 'Contains a <script> element; must not be rendered inline.');
  if (/<foreignObject\b/i.test(source)) add('FOREIGN_OBJECT', 'error', 'Contains <foreignObject>, which can embed HTML.');
  if (/\son[a-z]+\s*=/i.test(source)) add('EVENT_HANDLER', 'error', 'Contains an inline event handler attribute (on*).');
  if (/javascript:/i.test(source)) add('JAVASCRIPT_URL', 'error', 'Contains a javascript: URL.');

  const externalRefs = collectExternalRefs(source);
  if (externalRefs.length > 0) {
    add(
      'EXTERNAL_REFERENCE',
      'warning',
      `References external resources: ${externalRefs.slice(0, 3).join(', ')}${externalRefs.length > 3 ? '…' : ''}.`,
    );
  }
  if (/@import/i.test(source)) add('STYLE_IMPORT', 'error', 'Contains a CSS @import.');
  if (/<!ENTITY/i.test(source)) add('ENTITY_DECLARATION', 'warning', 'Declares XML entities; review for expansion attacks.');
  if (/<style\b/i.test(source)) add('INLINE_STYLE_BLOCK', 'info', 'Contains a <style> block.');
  if (/<text\b/i.test(source)) add('TEXT_ELEMENT', 'warning', 'Contains live <text>; rendering depends on fonts available on the host.');

  // ---- content ----------------------------------------------------------
  const counts = {};
  for (const name of RENDERABLE) {
    const hits = source.match(new RegExp(`<${name}\\b`, 'gi'));
    if (hits) counts[name] = hits.length;
  }
  if (!RENDERABLE.some((name) => counts[name])) add('NO_RENDERABLE_CONTENT', 'error', 'No renderable shape elements were found.');

  return summarize(fileName, bytes, findings, {
    viewBox,
    width,
    height,
    declaredWidth: rootAttrs.width ?? null,
    declaredHeight: rootAttrs.height ?? null,
    elements: counts,
    externalRefs,
    wellFormed: wellFormed.ok,
    ink: analyzeInkTone(source),
  });
}

/**
 * Estimate the ink tone of an SVG so the UI can pick a plate that keeps the
 * artwork visible in both themes (a black logo on a black card, or a white
 * badge on white paper, are the two failure cases this prevents).
 *
 * The estimate is deliberately simple and explainable: count the declared fill
 * colours, convert them to relative luminance and average. It is not a
 * perceptual render, so it is a hint for presentation only, never metadata.
 *
 * @param {string} source
 * @returns {{tone: 'dark'|'light'|'mixed', luminance: number, minLuminance: number, maxLuminance: number, samples: number}}
 */
export function analyzeInkTone(source) {
  /** @type {number[]} */
  const luminances = [];
  const push = (color) => {
    const lum = colorLuminance(color);
    if (lum !== null) luminances.push(lum);
  };

  // Presentation attributes: fill="#123", fill="rgb(...)", fill="white"
  const fillRe = /\bfill\s*=\s*"([^"]+)"/gi;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = fillRe.exec(source))) push(match[1]);
  const fillReSingle = /\bfill\s*=\s*'([^']+)'/gi;
  while ((match = fillReSingle.exec(source))) push(match[1]);

  // Style blocks / inline styles: fill:#123456
  const styleRe = /\bfill\s*:\s*([#a-zA-Z0-9(),.%\s]+?)\s*[;}"']/gi;
  while ((match = styleRe.exec(source))) push(match[1]);

  // No declared fill at all means SVG's default: black.
  const hasShapes = /<(path|rect|circle|ellipse|polygon|polyline)\b/i.test(source);
  if (luminances.length === 0 && hasShapes) luminances.push(0);

  if (luminances.length === 0) {
    return { tone: 'mixed', luminance: 0.5, minLuminance: 0.5, maxLuminance: 0.5, samples: 0 };
  }

  const average = luminances.reduce((a, b) => a + b, 0) / luminances.length;
  const min = Math.min(...luminances);
  const max = Math.max(...luminances);
  let tone = 'mixed';
  if (average <= 0.32) tone = 'dark';
  else if (average >= 0.7) tone = 'light';

  return {
    tone,
    luminance: Number(average.toFixed(3)),
    minLuminance: Number(min.toFixed(3)),
    maxLuminance: Number(max.toFixed(3)),
    samples: luminances.length,
  };
}

const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff',
  transparent: null,
  none: null,
  currentcolor: null,
  inherit: null,
};

/**
 * @param {string} input
 * @returns {number | null} relative luminance in 0..1, or null when not a colour
 */
function colorLuminance(input) {
  const value = input.trim().toLowerCase();
  if (value in NAMED_COLORS) {
    const resolved = NAMED_COLORS[value];
    return resolved ? luminanceFromRgb(hexToRgb(resolved)) : null;
  }
  if (value.startsWith('url(') || value.startsWith('var(')) return null;
  if (value.startsWith('#')) {
    const rgb = hexToRgb(value);
    return rgb ? luminanceFromRgb(rgb) : null;
  }
  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[, /]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return luminanceFromRgb(parts);
  }
  return null;
}

function hexToRgb(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  if (value.length === 8) value = value.slice(0, 6);
  if (value.length !== 6) return null;
  const int = Number.parseInt(value, 16);
  if (!Number.isFinite(int)) return null;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function luminanceFromRgb([r, g, b]) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectExternalRefs(source) {
  /** @type {string[]} */
  const refs = [];
  const patterns = [
    /\b(?:xlink:)?href\s*=\s*"([^"]+)"/gi,
    /\b(?:xlink:)?href\s*=\s*'([^']+)'/gi,
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
  ];
  for (const re of patterns) {
    /** @type {RegExpExecArray | null} */
    let m;
    while ((m = re.exec(source))) {
      const value = m[1].trim();
      if (/^(https?:)?\/\//i.test(value) || /^data:/i.test(value) || /^ftp:/i.test(value)) {
        if (!refs.includes(value)) refs.push(value);
      }
    }
  }
  return refs;
}

/**
 * @param {string} fileName
 * @param {number} bytes
 * @param {{code: string, severity: 'error'|'warning'|'info', message: string}[]} findings
 * @param {Record<string, unknown>} extra
 */
function summarize(fileName, bytes, findings, extra) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    file: fileName,
    bytes,
    format: 'svg',
    status: counts.error > 0 ? 'error' : counts.warning > 0 ? 'warning' : 'pass',
    counts,
    findings,
    ...extra,
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function byteLength(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return Buffer.byteLength(text, 'utf8');
}
