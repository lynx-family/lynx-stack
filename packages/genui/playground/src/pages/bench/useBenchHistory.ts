// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BenchHistoryEntry } from './benchHistory.js';
import {
  persistBenchHistory,
  readBenchHistory,
} from '../../storage/benchRepo.js';

export function useBenchHistory() {
  const [items, setItems] = useState<BenchHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('Loading Bench history…');
  const persisted = useRef<BenchHistoryEntry[]>([]);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void readBenchHistory().then((entries) => {
      if (cancelled) return;
      persisted.current = entries;
      setItems(entries);
      setReady(true);
      setNotice('');
    }).catch(() => {
      if (!cancelled) {
        setNotice(
          'Bench history could not be loaded. Allow browser storage and reload to retry; existing records have not been changed.',
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((entries: BenchHistoryEntry[]): Promise<void> => {
    // Compare against the last successful write inside the queue so fast edits,
    // deletions, and retries cannot overtake or resurrect earlier snapshots.
    const pending = queue.current.then(async () => {
      await persistBenchHistory(entries, persisted.current);
      persisted.current = entries;
    });
    queue.current = pending.catch(() => undefined);
    return pending;
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void save(items).then(() => {
      if (!cancelled) setNotice('');
    }).catch(() => {
      if (!cancelled) {
        setNotice(
          'History could not be saved in this browser (storage full or unavailable). Free some browser storage and retry View details before leaving; screenshots are still available in this page.',
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, ready, save]);

  return { items, setItems, ready, notice, save };
}
