import { createRoot } from 'react-dom/client';
import { act, createElement } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useDataset, __setDatasetForTests } from '../../src/hooks/useDataset';
import type { Dataset } from '../../src/types/asset';

const dataset = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/assets.json'), 'utf8')) as Dataset;

function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let latest: ReturnType<typeof useDataset> | null = null;
  function Probe() {
    latest = useDataset();
    return null;
  }
  act(() => root.render(createElement(Probe)));
  return { root, host, get state() { return latest; } };
}

describe('useDataset runtime boundary', () => {
  beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    __setDatasetForTests(null);
    vi.restoreAllMocks();
  });

  it('loads through the deployment base and accepts valid index data', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => dataset });
    vi.stubGlobal('fetch', fetch);
    const app = setup();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/data\/assets\.json$/), { credentials: 'same-origin', signal: expect.any(AbortSignal) });
    expect(app.state?.status).toBe('ready');
    if (app.state?.status === 'ready') expect(app.state.dataset.assets.length).toBe(dataset.assets.length);
    act(() => app.root.unmount());
    app.host.remove();
  });

  it('rejects malformed payload instead of casting it into app state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assets: 'bad' }) }));
    const app = setup();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(app.state?.status).toBe('error');
    if (app.state?.status === 'error') expect(app.state.error).toContain('malformed');
    act(() => app.root.unmount());
    app.host.remove();
  });

  it('returns a typed load error for non-200 responses and retries on remount', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => dataset });
    vi.stubGlobal('fetch', fetch);
    const first = setup();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(first.state?.status).toBe('error');
    act(() => first.root.unmount());
    first.host.remove();
    const second = setup();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(second.state?.status).toBe('ready');
    expect(fetch).toHaveBeenCalledTimes(2);
    act(() => second.root.unmount());
    second.host.remove();
  });
});
