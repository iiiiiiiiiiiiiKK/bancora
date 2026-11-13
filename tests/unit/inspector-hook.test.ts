import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInspector, MAX_INSPECT_UPLOAD_BYTES, MAX_INSPECT_UPLOAD_FILES } from '../../src/hooks/useInspector';
import type { Asset } from '../../src/types/asset';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

function harness() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let state: ReturnType<typeof useInspector> | null = null;
  function Probe() { state = useInspector(); return null; }
  act(() => root.render(createElement(Probe)));
  return { root, host, get current() { return state!; } };
}

const asset = {
  id: 'logos/sample', name: 'Sample', nameStatus: 'documented', nameSource: 'upstream-readme', aliases: [],
  filename: 'sample.svg', relativePath: 'logos/sample.svg', publicPath: '/logos/sample.svg', collection: 'logos', variant: 'plain',
  format: 'svg', fileSize: 20, sha256: 'a'.repeat(64), viewBox: '0 0 1 1', width: 1, height: 1,
  country: null, category: null, website: null,
  source: { upstream: 'https://example.invalid', collection: 'logos', npmExport: null, npmExports: [], npmPackage: null },
  license: { code: 'MIT', scope: 'test', trademark: 'unknown', note: 'test' },
  quality: { status: 'pass', findingCount: 0, codes: [], wellFormed: true, externalRefs: [] },
} as Asset;

function close(app: ReturnType<typeof harness>) { act(() => app.root.unmount()); app.host.remove(); }

describe('useInspector resource boundaries', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('records oversized SVG without reading its contents', async () => {
    const app = harness();
    const file = new File(['x'.repeat(MAX_INSPECT_UPLOAD_BYTES + 1)], 'oversized.svg', { type: 'image/svg+xml' });
    const textSpy = vi.fn();
    Object.defineProperty(file, 'text', { value: textSpy });
    let result: Awaited<ReturnType<typeof app.current.inspectFiles>> = [];
    await act(async () => { result = await app.current.inspectFiles([file]); });
    expect(textSpy).not.toHaveBeenCalled();
    expect(result[0].analysis.findings[0].code).toBe('FILE_TOO_LARGE');
    expect(app.current.uploads).toHaveLength(1);
    close(app);
  });

  it('rejects excess file count and aggregate bytes before parsing', async () => {
    const app = harness();
    const tooMany = Array.from({ length: MAX_INSPECT_UPLOAD_FILES + 1 }, (_, i) => new File(['<svg/>'], `${i}.svg`));
    await expect(app.current.inspectFiles(tooMany)).rejects.toThrow(/limited to/);
    const bigBatch = Array.from({ length: 17 }, (_, i) => ({ name: i + '.svg', size: 2 * 1024 * 1024, lastModified: i, text: vi.fn() })) as unknown as File[];
    await expect(app.current.inspectFiles(bigBatch)).rejects.toThrow(/budget/);
    close(app);
  });

  it('uses base-aware asset URLs and aborts an in-flight repository fetch', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const app = harness();
    const controller = new AbortController();
    let scan!: Promise<unknown>;
    let outcome: unknown;
    await act(async () => { scan = app.current.inspectRepository([asset], 1, controller.signal); scan.catch((error) => { outcome = error; }); await Promise.resolve(); });
    expect(fetchMock).toHaveBeenCalledWith('/logos/sample.svg', expect.objectContaining({ signal: controller.signal }));
    await act(async () => { controller.abort(); await Promise.resolve(); });
    await scan.catch(() => undefined);
    expect(outcome).toMatchObject({ name: 'AbortError' });
    expect(requestSignal?.aborted).toBe(true);
    expect(app.current.running).toBe(false);
    close(app);
  });
});
