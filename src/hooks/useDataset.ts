import { useEffect, useState } from 'react';
import type { Dataset } from '../types/asset';
import { withBase } from '../lib/paths';
import { validateDataset } from '../lib/dataset-validation';

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; dataset: Dataset };

let cached: Dataset | null = null;
let inFlight: Promise<Dataset> | null = null;
let inFlightController: AbortController | null = null;

async function loadDataset(): Promise<Dataset> {
  if (cached) return cached;
  if (!inFlight) {
    inFlightController = new AbortController();
    inFlight = (async () => {
      const response = await fetch(withBase('/data/assets.json'), { credentials: 'same-origin', signal: inFlightController?.signal });
      if (!response.ok) throw new Error(`Could not load the asset index (HTTP ${response.status}).`);
      const payload: unknown = await response.json();
      const validation = validateDataset(payload);
      if (!validation.ok) {
        const details = validation.issues.map((issue) => issue.path).join(', ');
        throw new Error(details ? `The asset index is malformed (${details}).` : 'The asset index is malformed.');
      }
      cached = validation.dataset;
      return validation.dataset;
    })().catch((error: unknown) => {
      inFlight = null;
      inFlightController = null;
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
      // Shared request continues for other consumers; suppress state updates here.
    };
  }, []);

  return state;
}

/** Test seam: replaces the cached dataset. */
export function __setDatasetForTests(dataset: Dataset | null) {
  cached = dataset;
  inFlight = null;
  inFlightController?.abort();
  inFlightController = null;
}
