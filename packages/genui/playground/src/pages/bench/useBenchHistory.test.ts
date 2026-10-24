// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { DEFAULT_BENCH_SETTINGS } from './benchData.js';
import type { BenchHistoryEntry } from './benchHistory.js';
import { useBenchHistory } from './useBenchHistory.js';
import {
  persistBenchHistory,
  readBenchHistory,
} from '../../storage/benchRepo.js';

rstest.mock(
  '../../storage/benchRepo.js',
  () => ({ persistBenchHistory: rstest.fn(), readBenchHistory: rstest.fn() }),
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function draft(id: string): BenchHistoryEntry {
  return {
    id,
    title: id,
    savedAt: '2026-09-09T00:00:00.000Z',
    report: null,
    config: {
      env: { model: '', apiKeyConfigured: false },
      settings: { ...DEFAULT_BENCH_SETTINGS },
      groups: [],
      scenarios: [],
    },
  };
}
let state: ReturnType<typeof useBenchHistory>;
let root: Root;
let container: HTMLDivElement;
function Probe() {
  state = useBenchHistory();
  return null;
}
beforeEach(() => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  rstest.mocked(readBenchHistory).mockReset();
  rstest.mocked(persistBenchHistory).mockReset().mockResolvedValue(undefined);
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(async () => {
  await React.act(async () => root.unmount());
  rstest.unstubAllGlobals();
});

test('waits for hydration before saving the loaded history', async () => {
  const loaded = deferred<BenchHistoryEntry[]>();
  rstest.mocked(readBenchHistory).mockReturnValue(loaded.promise);
  await React.act(async () => root.render(React.createElement(Probe)));
  expect(state.ready).toBe(false);
  expect(persistBenchHistory).not.toHaveBeenCalled();
  const existing = [draft('existing')];
  await React.act(async () => loaded.resolve(existing));
  expect(state.ready).toBe(true);
  expect(state.items).toBe(existing);
  expect(persistBenchHistory).toHaveBeenCalledWith(existing, existing);
});

test('keeps failed hydration read-only without writing empty history', async () => {
  rstest.mocked(readBenchHistory).mockRejectedValue(
    new Error('Storage unavailable'),
  );
  await React.act(async () => root.render(React.createElement(Probe)));
  expect(state.ready).toBe(false);
  expect(state.notice).toContain('could not be loaded');
  expect(persistBenchHistory).not.toHaveBeenCalled();
});

test('serializes rapid edits and deletion, then retries against the last successful write', async () => {
  const existing = [draft('existing')];
  rstest.mocked(readBenchHistory).mockResolvedValue(existing);
  await React.act(async () => root.render(React.createElement(Probe)));
  const writing = deferred<void>();
  rstest.mocked(persistBenchHistory).mockClear().mockImplementationOnce(() =>
    writing.promise
  );
  const edited = [{ ...existing[0]!, title: 'Edited' }];
  await React.act(async () => state.setItems(edited));
  await React.act(async () => state.setItems([]));
  expect(persistBenchHistory).toHaveBeenCalledTimes(1);
  expect(persistBenchHistory).toHaveBeenLastCalledWith(edited, existing);
  rstest.mocked(persistBenchHistory).mockRejectedValueOnce(new Error('Full'));
  await React.act(async () => writing.resolve());
  expect(persistBenchHistory).toHaveBeenLastCalledWith([], edited);
  expect(state.notice).toContain('could not be saved');
  await React.act(async () => state.save(state.items));
  expect(persistBenchHistory).toHaveBeenLastCalledWith([], edited);
  expect(persistBenchHistory).toHaveBeenCalledTimes(3);
});
