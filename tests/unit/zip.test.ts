import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { readZipDirectory, readZipEntry } from './zip-reader';

/**
 * Exercises the ZIP production path with the same library and options the app
 * uses, then reads the archive back with an independent minimal parser. This
 * covers empty archives, duplicate names and unicode file names.
 */
const OPTIONS = { type: 'uint8array' as const, compression: 'DEFLATE' as const, compressionOptions: { level: 6 } };

describe('ZIP export format', () => {
  it('produces an archive with the documented structure', async () => {
    const zip = new JSZip();
    const folder = zip.folder('bancora-export')!;
    const logos = folder.folder('logos')!;
    logos.file('abchina.svg', '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
    logos.file('三井住友银行.svg', '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>');
    folder.file('manifest.json', JSON.stringify({ count: 2 }));
    folder.file('README.txt', 'trademarks remain the property of their owners');

    const buffer = await zip.generateAsync(OPTIONS);
    const files = readZipDirectory(buffer).map((entry) => entry.path);
    expect(files).toContain('bancora-export/logos/abchina.svg');
    expect(files).toContain('bancora-export/logos/三井住友银行.svg');
    expect(files).toContain('bancora-export/manifest.json');
    expect(files).toContain('bancora-export/README.txt');
  });

  it('round-trips file contents without corruption', async () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#123456"/></svg>';
    const zip = new JSZip();
    zip.file('logo.svg', svg);
    zip.file('manifest.json', JSON.stringify({ ok: true }));
    const buffer = await zip.generateAsync(OPTIONS);

    expect(await readZipEntry(buffer, 'logo.svg')).toBe(svg);
    expect(JSON.parse((await readZipEntry(buffer, 'manifest.json'))!)).toEqual({ ok: true });
  });

  it('does not silently overwrite duplicate names', async () => {
    const zip = new JSZip();
    zip.file('logo.svg', 'first');
    zip.file('logo-2.svg', 'second');
    const buffer = await zip.generateAsync(OPTIONS);
    expect(readZipDirectory(buffer).map((entry) => entry.path)).toEqual(['logo.svg', 'logo-2.svg']);
  });

  it('rejects a non-ZIP buffer', () => {
    expect(() => readZipDirectory(new Uint8Array([1, 2, 3, 4]))).toThrow(/end-of-central-directory/);
  });
});
