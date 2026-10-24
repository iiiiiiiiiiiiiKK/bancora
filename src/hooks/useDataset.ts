import { useEffect, useState } from 'react';
import type { Dataset } from '../types/asset';
import { withBase } from '../lib/paths';

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; dataset: Dataset };

let cached: Dataset | null = null;
let inFlight: Promise<Dataset> | null = null;

async function loadDataset(): Promise<Dataset> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = (async () => {
      const response = await fetch(withBase('/data/assets.json'), { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Could not load the asset index (HTTP ${response.status}).`);
      const data = (await response.json()) as Dataset;
      if (!data || !Array.isArray(data.assets)) throw new Error('The asset index is malformed.');
      cached = data;
      return data;
    })().catch((error: unknown) => {
      inFlight = null;
      throw error;
    });
  }
  return inFlight;
}

/** Loads the generated index once per page load and shares it across routes. */
export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>(() =>
    cached ? { status: 'ready', dataset: cached } : { status: 'loading' },
  );

  useEffect(() => {
    let active = true;
    loadDataset()
      .then((dataset) => {
        if (active) setState({ status: 'ready', dataset });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** Test seam: replaces the cached dataset. */
export function __setDatasetForTests(dataset: Dataset | null) {
  cached = dataset;
  inFlight = null;
}
