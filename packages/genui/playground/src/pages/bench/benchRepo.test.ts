// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

import {
  DEFAULT_BENCH_SCENARIOS,
  DEFAULT_BENCH_SETTINGS,
  createDefaultBenchGroups,
} from './benchData.js';
import type { BenchHistoryEntry } from './benchHistory.js';
import {
  BENCH_SELECTED_REPORT_STORAGE_KEY,
  LEGACY_BENCH_HISTORY_KEY,
  getSelectedBenchReportId,
  persistBenchHistory,
  readBenchHistory,
  selectBenchReport,
  subscribeBenchHistory,
} from '../../storage/benchRepo.js';
import { getDB } from '../../storage/db.js';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function entry(id: string, completed = false): BenchHistoryEntry {
  const config = {
    env: { model: 'test-model', apiKeyConfigured: false },
    settings: { ...DEFAULT_BENCH_SETTINGS },
    groups: createDefaultBenchGroups('test-model'),
    scenarios: DEFAULT_BENCH_SCENARIOS.map((scenario) => ({ ...scenario })),
  };
  return {
    id,
    title: id,
    savedAt: '2026-09-09T00:00:00.000Z',
    config,
    report: completed
      ? {
        ...config,
        id,
        createdAt: '2026-09-09T00:00:00.000Z',
        results: [{
          id: 'run',
          screenshotDataUrl: PNG,
          agentMs: 1,
          attempts: 1,
          fmpMs: 1,
          groupId: 'group',
          groupName: 'Group',
          judgeScore: 1,
          renderMs: 1,
          role: 'control',
          scenarioId: 'scenario',
          scenarioName: 'Scenario',
          ttiMs: 1,
          tokens: 1,
        }],
        summaries: [],
      }
      : null,
  };
}

describe('Bench local database', () => {
  beforeAll(async () => {
    const legacy = await openDB('a2ui-playground', 1, {
      upgrade(db) {
        db.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
          'by_updatedAt',
          'updatedAt',
        );
        db.createObjectStore('messages', { keyPath: ['conversationId', 'seq'] })
          .createIndex('by_conversation', 'conversationId');
        db.createObjectStore('snapshots', { keyPath: 'conversationId' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    await legacy.put('conversations', {
      id: 'chat',
      title: 'Existing chat',
      updatedAt: 1,
    });
    await legacy.put('messages', {
      conversationId: 'chat',
      seq: 0,
      content: 'Existing message',
    });
    await legacy.put('snapshots', {
      conversationId: 'chat',
      dataModel: { count: 1 },
    });
    await legacy.put('meta', { key: 'conversation-selection', value: 'chat' });
    legacy.close();
  });

  beforeEach(async () => {
    const db = await getDB();
    await db.clear('benchHistory');
    await db.delete('meta', 'benchHistory:localStorageMigrated');
    await db.delete('meta', BENCH_SELECTED_REPORT_STORAGE_KEY);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    rstest.restoreAllMocks();
  });

  test('upgrades version 1 without changing conversation data', async () => {
    const db = await getDB();
    expect(db.version).toBe(2);
    await expect(db.get('conversations', 'chat')).resolves.toMatchObject({
      title: 'Existing chat',
    });
    await expect(db.get('messages', ['chat', 0])).resolves.toMatchObject({
      content: 'Existing message',
    });
    await expect(db.get('snapshots', 'chat')).resolves.toMatchObject({
      dataModel: { count: 1 },
    });
    await expect(db.get('meta', 'conversation-selection')).resolves
      .toMatchObject({ value: 'chat' });
  });

  test('migrates drafts, screenshots and selection once without replacing existing IDs', async () => {
    const existing = { ...entry('completed', true), title: 'Database version' };
    const db = await getDB();
    await db.put('benchHistory', existing);
    const legacy = [entry('draft'), entry('completed', true)];
    window.localStorage.setItem(
      LEGACY_BENCH_HISTORY_KEY,
      JSON.stringify(legacy),
    );
    window.localStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, 'completed');
    const results = await readBenchHistory();
    expect(results).toHaveLength(2);
    expect(results.find((item) => item.id === 'draft')?.report).toBeNull();
    expect(results.find((item) => item.id === 'completed')).toMatchObject({
      title: 'Database version',
      report: { results: [{ screenshotDataUrl: PNG }] },
    });
    expect(await getSelectedBenchReportId()).toBe('completed');
    expect(window.localStorage.getItem(LEGACY_BENCH_HISTORY_KEY)).toBeNull();
    expect(window.localStorage.getItem(BENCH_SELECTED_REPORT_STORAGE_KEY))
      .toBeNull();
    window.localStorage.setItem(
      LEGACY_BENCH_HISTORY_KEY,
      JSON.stringify([entry('stale')]),
    );
    expect(await readBenchHistory()).toHaveLength(2);
  });

  test('keeps the legacy copy and rolls back partial imports when a write fails, then retries', async () => {
    const raw = JSON.stringify([entry('first'), entry('second', true)]);
    window.localStorage.setItem(LEGACY_BENCH_HISTORY_KEY, raw);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Called with the object store receiver below.
    const original = IDBObjectStore.prototype.put;
    const put = rstest.spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementation(
        function(this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
          if (
            this.name === 'benchHistory'
            && (value as BenchHistoryEntry).id === 'second'
          ) throw new window.DOMException('Full', 'QuotaExceededError');
          return original.call(this, value, key);
        },
      );
    await expect(readBenchHistory()).rejects.toThrow('Full');
    expect(window.localStorage.getItem(LEGACY_BENCH_HISTORY_KEY)).toBe(raw);
    const db = await getDB();
    expect(await db.count('benchHistory')).toBe(0);
    put.mockRestore();
    expect(await readBenchHistory()).toHaveLength(2);
    expect(window.localStorage.getItem(LEGACY_BENCH_HISTORY_KEY)).toBeNull();
  });

  test('preserves unreadable legacy data instead of replacing it with empty history', async () => {
    window.localStorage.setItem(LEGACY_BENCH_HISTORY_KEY, '{invalid');
    await expect(readBenchHistory()).rejects.toThrow();
    expect(window.localStorage.getItem(LEGACY_BENCH_HISTORY_KEY)).toBe(
      '{invalid',
    );
    const db = await getDB();
    expect(await db.count('benchHistory')).toBe(0);
  });

  test('updates and deletes page-owned entries while preserving another tab’s new history', async () => {
    const draft = entry('draft');
    await persistBenchHistory([draft]);
    await persistBenchHistory([entry('other-tab', true)]);
    const completed = entry('draft', true);
    await persistBenchHistory([completed], [draft]);
    expect(await readBenchHistory()).toHaveLength(2);
    await selectBenchReport('draft');
    await persistBenchHistory([], [completed]);
    const remaining = await readBenchHistory();
    expect(remaining.map((item) => item.id)).toEqual(['other-tab']);
    expect(await getSelectedBenchReportId()).toBeNull();
  });

  test('stores reports beyond localStorage capacity without writing or evicting screenshots there', async () => {
    await readBenchHistory();
    rstest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      throw new window.DOMException('Full', 'QuotaExceededError');
    });
    const reports = Array.from({ length: 8 }, (_, i) => {
      const item = entry(`report-${i}`, true);
      item.report!.results[0]!.error = 'A report paragraph. '.repeat(65536);
      return item;
    });
    await persistBenchHistory(reports);
    const loaded = await readBenchHistory();
    expect(loaded).toHaveLength(8);
    for (const item of loaded) {
      expect(item.report?.results[0]?.screenshotDataUrl).toBe(PNG);
    }
  });

  test('notifies after commit and keeps each report tab on its session selection', async () => {
    const listener = rstest.fn();
    const unsubscribe = subscribeBenchHistory(listener);
    try {
      window.sessionStorage.setItem(BENCH_SELECTED_REPORT_STORAGE_KEY, 'first');
      await persistBenchHistory([entry('first', true)]);
      expect(listener).toHaveBeenCalledTimes(1);
      const db = await getDB();
      expect(await db.count('benchHistory')).toBe(1);
      await selectBenchReport('second');
      expect(await getSelectedBenchReportId()).toBe('first');
    } finally {
      unsubscribe();
    }
  });
});
