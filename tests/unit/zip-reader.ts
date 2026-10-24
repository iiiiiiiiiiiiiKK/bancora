export interface ZipFileEntry {
  path: string;
  bytes: number;
}

/** Minimal ZIP central-directory reader used by tests to verify real archives. */
export function readZipDirectory(buffer: Uint8Array): ZipFileEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  // End of central directory record: signature 0x06054b50, scanned from the end.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66_000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive: end-of-central-directory record not found.');

  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files: ZipFileEntry[] = [];

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Corrupt central directory.');
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength));
    files.push({ path: name, bytes: compressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** Read one stored/deflated entry. Used to verify the manifest content in tests. */
export async function readZipEntry(buffer: Uint8Array, path: string): Promise<string | null> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 66_000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index += 1) {
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength));
    if (name === path) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return decoder.decode(data);
      if (method === 8) {
        // Raw DEFLATE — node:zlib is available in the Vitest environment.
        const { inflateRawSync } = await import('node:zlib');
        return decoder.decode(inflateRawSync(data));
      }
      throw new Error(`Unsupported compression method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}
