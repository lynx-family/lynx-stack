// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createParser, evaluate } from '@openuidev/lang-core';
import { expect, rstest, test } from '@rstest/core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui/openui/prompt';

import {
  executeOpenUIDataTool,
  openUIStorageKey,
  restoreOpenUIData,
} from './dataHost.js';
import { readOpenUIQueryDefaults } from './inspector.js';
import { createDataTools } from '../../lynx-src/openui/dataTools.js';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const initialQueryResults = {
  todos: {
    items: [{ id: 1, text: 'First', done: false }],
    count: 0,
    active: false,
  },
};
const page = {
  rawText: `todos = Query("openui_query", { key: "todos" }, ${
    JSON.stringify(initialQueryResults.todos)
  })\nroot = Stack([])`,
  isStreaming: false,
};

function createRuntime(storage = createStorage()) {
  let defaults: Record<string, unknown> = {};
  const call = rstest.fn(
    (
      request: import('../../lynx-src/openui/dataTools.js').LocalDataRequest,
    ) => {
      if (request.operation === 'initialize') {
        defaults = request.args.defaults as Record<string, unknown>;
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve(executeOpenUIDataTool(request, storage, defaults));
    },
  );
  const runtime = createDataTools(call);
  runtime.setScope(page.rawText);
  runtime.publishDefaults(page.rawText, initialQueryResults);
  return { runtime, call, storage };
}

test.each([0, { count: 0 }])(
  'resolves a tool key distinct from its Query name and restores the saved result: %j',
  async initial => {
    const library = createOpenUiPromptLibrary();
    const expression = typeof initial === 'number'
      ? 'data + 1'
      : '{ count: data.count + 1 }';
    const source = `root = Stack([])
data = Query("openui_query", { key: "counter" }, ${JSON.stringify(initial)})
increment = Mutation("openui_mutation", { key: "counter", value: ${expression} })`;
    const parsed = createParser(library.toJSONSchema(), library.root).parse(
      source,
    );
    expect(parsed.meta.errors).toEqual([]);
    const { runtime, storage, call } = createRuntime();
    runtime.setScope(source);
    const firstRead = runtime.tools.openui_query({ key: 'counter' });
    runtime.publishParseResult(source, parsed, source);
    expect(await firstRead).toEqual(initial);
    const args = evaluate(parsed.mutationStatements[0]!.argsAST!, {
      getState: () => null,
      resolveRef: () => initial,
    }) as Record<string, unknown>;
    await runtime.tools.openui_mutation(args);
    const expected = typeof initial === 'number' ? 1 : { count: 1 };
    expect(await runtime.tools.openui_query({ key: 'counter' })).toEqual(
      expected,
    );
    expect(call).toHaveBeenLastCalledWith({
      rawText: source,
      operation: 'query',
      args: { key: 'data' },
    });
    expect(restoreOpenUIData({ rawText: source }, storage)).toEqual({
      rawText: source,
      initialQueryResults: { data: expected },
    });
    runtime.dispose();
    const reloaded = createRuntime(storage).runtime;
    reloaded.setScope(source);
    reloaded.publishParseResult(source, parsed, source);
    expect(await reloaded.tools.openui_query({ key: 'counter' })).toEqual(
      expected,
    );
    await expect(reloaded.tools.openui_query({ key: 'unknown' })).rejects
      .toThrow('Unknown OpenUI data resource');
    reloaded.setScope(page.rawText);
    reloaded.publishDefaults(page.rawText, { data: 42 });
    // A late parse callback from the previous page must not restore its alias.
    reloaded.publishParseResult(source, parsed, source);
    await expect(reloaded.tools.openui_query({ key: 'counter' })).rejects
      .toThrow('Unknown OpenUI data resource');
    reloaded.dispose();
  },
);

test('registers completed inline Query aliases and rejects ambiguous resource keys', async () => {
  const library = createOpenUiPromptLibrary();
  const parser = createParser(library.toJSONSchema(), library.root);
  const { runtime } = createRuntime();
  const first =
    'root = Stack([])\ndata = Query("openui_query", { key: "counter" }, 0)';
  const second =
    'root = Stack([])\nenabled = Query("openui_query", { key: "flag" }, false)';
  runtime.publishParseResult(page.rawText, parser.parse(first), first);
  runtime.publishParseResult(page.rawText, parser.parse(second), second);
  expect(await runtime.tools.openui_query({ key: 'counter' })).toBe(0);
  expect(await runtime.tools.openui_query({ key: 'flag' })).toBe(false);
  const partial =
    'root = Stack([])\npending = Query("openui_query", { key: "counter" }, {';
  runtime.publishParseResult(page.rawText, parser.parse(partial), partial);
  expect(await runtime.tools.openui_query({ key: 'counter' })).toBe(0);
  const duplicate =
    'root = Stack([])\nother = Query("openui_query", { key: "counter" }, 5)';
  runtime.publishParseResult(page.rawText, parser.parse(duplicate), duplicate);
  await expect(runtime.tools.openui_mutation({ key: 'counter', value: 7 }))
    .rejects.toThrow('used by multiple Queries');
  runtime.dispose();
});

test('persists complete values locally across reloads without modifying source or defaults', async () => {
  const { runtime, storage } = createRuntime();
  const query = () => runtime.tools.openui_query({ key: 'todos' });
  expect(await query()).toEqual(initialQueryResults.todos);
  const value = { items: [{ id: 1, text: 'Edited', done: true }] };
  await runtime.tools.openui_mutation({ key: 'todos', value });
  expect(await query()).toEqual(value);
  runtime.setScope(page.rawText);
  expect(
    await createRuntime(storage).runtime.tools.openui_query({ key: 'todos' }),
  )
    .toEqual(value);
  expect(initialQueryResults.todos.items[0]!.text).toBe('First');
  expect(JSON.parse(storage.getItem(openUIStorageKey(page.rawText))!))
    .toEqual({ source: page.rawText, data: { todos: value } });
});

test('preserves falsy and empty replacements and isolates different pages', async () => {
  const { runtime, storage } = createRuntime();
  for (const value of [false, 0, null, [], {}, '']) {
    await runtime.tools.openui_mutation({ key: 'todos', value });
    expect(
      await createRuntime(storage).runtime.tools.openui_query({ key: 'todos' }),
    )
      .toEqual(value);
  }
  const otherSource = page.rawText + '\n// another page';
  runtime.setScope(otherSource);
  runtime.publishDefaults(otherSource, initialQueryResults);
  expect(await runtime.tools.openui_query({ key: 'todos' }))
    .toEqual(initialQueryResults.todos);
});

test('missing values and legacy instructions never change stored data', async () => {
  const { runtime, storage } = createRuntime();
  for (
    const args of [
      { key: 'todos' },
      { key: 'todos', value: undefined },
      {
        key: 'todos',
        operations: [{ op: 'increment', path: ['count'], value: 1 }],
      },
      { key: 'todos', instruction: 'Ask a model to add a task' },
      { key: 'unknown', value: 1 },
    ]
  ) {
    await expect(runtime.tools.openui_mutation(args)).rejects.toThrow();
    expect(await runtime.tools.openui_query({ key: 'todos' }))
      .toEqual(initialQueryResults.todos);
  }
  expect(storage.getItem(openUIStorageKey(page.rawText))).toBeNull();
});

test('storage failures report an error without claiming a successful mutation', async () => {
  const storage = createStorage();
  const { runtime } = createRuntime({
    ...storage,
    setItem: () => {
      throw new Error('quota exceeded');
    },
  });
  await expect(
    runtime.tools.openui_mutation({
      key: 'todos',
      value: { count: 1 },
    }),
  ).rejects.toThrow('quota exceeded');
  expect(await runtime.tools.openui_query({ key: 'todos' })).toEqual(
    initialQueryResults.todos,
  );
});

test('missing host support and replies for a replaced page are rejected', async () => {
  const runtime = createDataTools(async () => undefined);
  runtime.setScope(page.rawText);
  runtime.publishDefaults(page.rawText, initialQueryResults);
  await expect(runtime.tools.openui_query({ key: 'todos' })).rejects.toThrow(
    'does not support',
  );
  let reply!: (value: unknown) => void;
  const delayed = createDataTools(request =>
    request.operation === 'initialize'
      ? Promise.resolve({ ok: true })
      : new Promise(resolve => {
        reply = resolve;
      })
  );
  delayed.setScope(page.rawText);
  delayed.publishDefaults(page.rawText, initialQueryResults);
  const result = delayed.tools.openui_query({ key: 'todos' });
  await new Promise(resolve => setTimeout(resolve, 0));
  delayed.setScope('new page');
  reply({ ok: true, value: 'old result' });
  await expect(result).rejects.toThrow('scope changed');
});

test('extracts complete client Query defaults, preserving state references and falsy values', () => {
  expect(readOpenUIQueryDefaults([
    '$count = 2',
    'count = Query("openui_query", { key: "count" }, $count)',
    'zero = Query("openui_query", { key: "zero" }, 0)',
    'off = Query("openui_query", { key: "off" }, false)',
    'empty = Query("openui_query", { key: "empty" }, null)',
    'partial = Query("openui_query", { key: "partial" }, { count:',
  ].join('\n'))).toEqual({ count: 2, zero: 0, off: false, empty: null });
});

test('restores local results through initialQueryResults before rendering without persisting defaults', async () => {
  const { runtime, storage, call } = createRuntime();
  expect(restoreOpenUIData(page, storage)).not.toHaveProperty(
    'initialQueryResults',
  );
  await runtime.tools.openui_mutation({
    key: 'todos',
    value: false,
  });
  const restored = restoreOpenUIData({
    ...page,
    initialQueryResults: { todos: { stale: true }, external: 0 },
  }, storage);
  expect(restored.initialQueryResults).toEqual({ todos: false, external: 0 });
  runtime.setScope(restored.rawText);
  expect(await runtime.tools.openui_query({ key: 'todos' })).toBe(false);
  expect(call.mock.calls[call.mock.calls.length - 1]![0]).not.toHaveProperty(
    'initialQueryResults',
  );
  // Once storage is removed, a restored snapshot must not become a new seed.
  const reset = createDataTools(async request =>
    request.operation === 'initialize'
      ? { ok: true }
      : executeOpenUIDataTool(
        request,
        createStorage(),
        initialQueryResults,
      )
  );
  reset.setScope(restored.rawText);
  reset.publishDefaults(restored.rawText, initialQueryResults);
  expect(await reset.tools.openui_query({ key: 'todos' })).toEqual(
    initialQueryResults.todos,
  );
  expect(
    restoreOpenUIData({ ...page, rawText: page.rawText + '\n// new' }, storage),
  )
    .not.toHaveProperty('initialQueryResults');
});

test('merges local first-screen results by Query name while preserving untouched prefetches', () => {
  const storage = createStorage();
  const rawText = [
    'root = Stack([])',
    'items = Query("openui_query", { key: "items" }, [1])',
    'enabled = Query("openui_query", { key: "enabled" }, true)',
    'count = Query("openui_query", { key: "count" }, 1)',
    'selection = Query("openui_query", { key: "selection" }, "first")',
  ].join('\n');
  const local = { items: [], enabled: false, count: 0, selection: null };
  const stored = JSON.stringify({ source: rawText, data: local });
  storage.setItem(openUIStorageKey(rawText), stored);
  const hostResults = { items: [3], hostOnly: { ready: true } };
  const restored = restoreOpenUIData({
    rawText,
    initialQueryResults: hostResults,
  }, storage);
  expect(restored).toEqual({
    rawText,
    initialQueryResults: {
      ...hostResults,
      ...local,
    },
  });
  expect(hostResults.items).toEqual([3]);
  expect(storage.getItem(openUIStorageKey(rawText))).toBe(stored);
});

test('waits only for tool initialization and cancels pending tools when source changes or unmounts', async () => {
  const call = rstest.fn(async () => ({ ok: true, value: 0 }));
  const runtime = createDataTools(call);
  runtime.setScope(page.rawText);
  const first = runtime.tools.openui_query({ key: 'todos' });
  expect(call).not.toHaveBeenCalled();
  runtime.publishDefaults(page.rawText, initialQueryResults);
  expect(await first).toBe(0);
  expect(call.mock.calls).toHaveLength(2);
  runtime.setScope('next');
  const stale = runtime.tools.openui_query({ key: 'todos' });
  runtime.setScope(page.rawText);
  await expect(stale).rejects.toThrow('scope changed');
  const unmounted = runtime.tools.openui_query({ key: 'todos' });
  runtime.dispose();
  await expect(unmounted).rejects.toThrow('scope changed');
});

test('restores saved first-screen data without needing parseable DSL', () => {
  const storage = createStorage();
  const rawText = 'not parsed during restore';
  storage.setItem(
    openUIStorageKey(rawText),
    JSON.stringify({ source: rawText, data: { value: false } }),
  );
  expect(restoreOpenUIData({ rawText }, storage)).toEqual({
    rawText,
    initialQueryResults: { value: false },
  });
  expect(
    executeOpenUIDataTool(
      { rawText, operation: 'query', args: { key: 'value' } },
      createStorage(),
      { value: 0 },
    ),
  )
    .toEqual({ ok: true, value: 0 });
});

test('bounds waiting when the renderer never reports defaults', async () => {
  rstest.useFakeTimers();
  const call = rstest.fn(async () => ({ ok: true }));
  const runtime = createDataTools(call);
  runtime.setScope(page.rawText);
  try {
    const result = runtime.tools.openui_query({ key: 'todos' });
    const rejected = expect(result).rejects.toThrow('not ready');
    await rstest.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(call).not.toHaveBeenCalled();
  } finally {
    runtime.dispose();
    rstest.useRealTimers();
  }
});

test('combines renderer defaults across inline blocks and skips unchanged registrations', async () => {
  const call = rstest.fn(async () => ({ ok: true, value: false }));
  const runtime = createDataTools(call);
  runtime.setScope(page.rawText);
  runtime.publishDefaults(page.rawText, { first: 0 });
  runtime.publishDefaults(page.rawText, { second: false });
  runtime.publishDefaults(page.rawText, { first: 0 });
  expect(call.mock.calls).toHaveLength(2);
  expect(call).toHaveBeenLastCalledWith({
    operation: 'initialize',
    rawText: page.rawText,
    args: { defaults: { first: 0, second: false } },
  });
  expect(await runtime.tools.openui_query({ key: 'second' })).toBe(false);
  expect(call).toHaveBeenLastCalledWith({
    operation: 'query',
    rawText: page.rawText,
    args: { key: 'second' },
  });
});
