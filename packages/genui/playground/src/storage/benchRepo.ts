// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getDB } from './db.js';
import {
  migrateBenchHistoryEntries,
  prepareBenchHistoryEntries,
} from '../pages/bench/benchHistory.js';
import type { BenchHistoryEntry } from '../pages/bench/benchHistory.js';

export const LEGACY_BENCH_HISTORY_KEY = 'a2ui-bench-history';
export const BENCH_SELECTED_REPORT_STORAGE_KEY = 'a2ui-bench-selected-report';
const MIGRATION_KEY = 'benchHistory:localStorageMigrated';
const CHANGE_EVENT = 'genui:bench-history-changed';

/** Import legacy reports once, without replacing records already saved in IDB. */
async function readyDB() {
  const db = await getDB();
  if (await db.get('meta', MIGRATION_KEY)) return db;
  const storage = typeof window === 'undefined'
    ? undefined
    : window.localStorage;
  const raw = storage?.getItem(LEGACY_BENCH_HISTORY_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) {
    throw new Error('Local Bench history could not be read.');
  }
  const entries = prepareBenchHistoryEntries(
    migrateBenchHistoryEntries(parsed),
  );
  const selectedId = storage?.getItem(BENCH_SELECTED_REPORT_STORAGE_KEY);
  const tx = db.transaction(['benchHistory', 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const history = tx.objectStore('benchHistory');
  try {
    if (!await meta.get(MIGRATION_KEY)) {
      for (const entry of entries) {
        if (!await history.get(entry.id)) await history.put(entry);
      }
      if (selectedId && !await meta.get(BENCH_SELECTED_REPORT_STORAGE_KEY)) {
        await meta.put({
          key: BENCH_SELECTED_REPORT_STORAGE_KEY,
          value: selectedId,
        });
      }
      await meta.put({ key: MIGRATION_KEY, value: '1' });
    }
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch { /* Already aborted or completed. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
  // Never discard the legacy copy until the entire migration has committed.
  try {
    storage?.removeItem(LEGACY_BENCH_HISTORY_KEY);
    storage?.removeItem(BENCH_SELECTED_REPORT_STORAGE_KEY);
  } catch {
    // The durable marker prevents re-import even when legacy cleanup is blocked.
  }
  return db;
}

export async function readBenchHistory(): Promise<BenchHistoryEntry[]> {
  const db = await readyDB();
  const entries = await db.getAllFromIndex('benchHistory', 'by_savedAt');
  return migrateBenchHistoryEntries(entries).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt)
  );
}

/** Apply only this page's changes, preserving records created in other tabs. */
export async function persistBenchHistory(
  entries: BenchHistoryEntry[],
  previous: BenchHistoryEntry[] = [],
): Promise<void> {
  const oldEntries = new Map(previous.map((entry) => [entry.id, entry]));
  const ids = new Set(entries.map((entry) => entry.id));
  const changed = prepareBenchHistoryEntries(
    entries.filter((entry) => oldEntries.get(entry.id) !== entry),
  );
  const deleted = previous.filter((entry) => !ids.has(entry.id));
  if (changed.length === 0 && deleted.length === 0) return;
  const db = await readyDB();
  const tx = db.transaction(['benchHistory', 'meta'], 'readwrite');
  const history = tx.objectStore('benchHistory');
  const meta = tx.objectStore('meta');
  try {
    for (const entry of changed) await history.put(entry);
    for (const entry of deleted) await history.delete(entry.id);
    const selection = await meta.get(BENCH_SELECTED_REPORT_STORAGE_KEY);
    if (deleted.some((entry) => entry.id === selection?.value)) {
      await meta.delete(BENCH_SELECTED_REPORT_STORAGE_KEY);
    }
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch { /* Already aborted or completed. */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
  notifyBenchHistoryChanged();
}

export async function selectBenchReport(id: string): Promise<void> {
  const db = await readyDB();
  await db.put('meta', { key: BENCH_SELECTED_REPORT_STORAGE_KEY, value: id });
  notifyBenchHistoryChanged();
}

export function setBenchReportTabSelection(tab: Window, id: string): void {
  tab.sessionStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, id);
}

export async function getSelectedBenchReportId(): Promise<string | null> {
  const tabId = typeof window === 'undefined'
    ? null
    : window.sessionStorage.getItem(BENCH_SELECTED_REPORT_STORAGE_KEY);
  if (tabId) return tabId;
  const db = await readyDB();
  const selection = await db.get('meta', BENCH_SELECTED_REPORT_STORAGE_KEY);
  return selection?.value ?? null;
}

function notifyBenchHistoryChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    const channel = openChangeChannel();
    channel?.postMessage(null);
    channel?.close();
  } catch {
    // Notifications must not turn a committed write into a storage failure.
  }
}

function openChangeChannel() {
  try {
    return typeof window.BroadcastChannel === 'undefined'
      ? null
      : new window.BroadcastChannel(CHANGE_EVENT);
  } catch {
    return null;
  }
}

/** IDB does not emit storage events; notify report tabs after committed writes. */
export function subscribeBenchHistory(listener: () => void): () => void {
  const channel = openChangeChannel();
  if (channel) channel.onmessage = listener;
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('focus', listener);
  return () => {
    channel?.close();
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('focus', listener);
  };
}
