/** Small DOM helpers shared by downloads, clipboard and ZIP code paths. */

export interface FetchResult {
  text: string;
  bytes: number;
  url: string;
}

/**
 * Fetch the raw SVG text from the deployment. Always resolves through the
 * public URL so it works identically in dev, preview and production.
 */
export async function fetchSvgText(url: string): Promise<FetchResult> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status} for ${url}`);
  const text = await response.text();
  if (!/^\s*(?:<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(text)) {
    throw new Error('The response is not an SVG document.');
  }
  return { text, bytes: new Blob([text]).size, url };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

export function downloadText(text: string, filename: string, type = 'image/svg+xml'): void {
  triggerDownload(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

export type CopyResult = { ok: true } | { ok: false; error: string };

/** Clipboard write with a `document.execCommand` fallback for non-secure contexts. */
export async function copyText(text: string): Promise<CopyResult> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok ? { ok: true } : { ok: false, error: 'The browser blocked clipboard access.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Clipboard is unavailable.' };
  }
}

/** Local storage that never throws — private mode and quota errors degrade quietly. */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  available(): boolean {
    try {
      const probe = '__bancora_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  },
};
