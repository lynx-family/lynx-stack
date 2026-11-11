// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFileSync } from 'node:child_process';

import {
  createLibrary,
  createParser,
  defineComponent,
  evaluate,
} from '@openuidev/lang-core';
import { expect, rstest, test } from '@rstest/core';
import { z } from 'zod/v4';

import {
  createQueryDataStore,
  getQueryDefaults,
} from '../src/data-tools/index.js';
import type { InitialQueryResults } from '../src/data-tools/index.js';

const library = createLibrary({
  root: 'Custom',
  components: [defineComponent({
    name: 'Custom',
    props: z.object({ value: z.unknown() }),
    component: () => null,
  })],
});
const parser = createParser(library.toJSONSchema(), library.root);

function setup(scope = 'document-1') {
  const saved = new Map<string, InitialQueryResults>();
  const storage = {
    read: (key: string) => saved.get(key) ?? null,
    write: rstest.fn((key: string, data: InitialQueryResults) => {
      saved.set(key, data);
    }),
  };
  const initialQueryResults = {
    rows: { items: [{ id: 1, text: 'First' }], count: 0, active: false },
  };
  const options = {
    scope,
    storage,
    initialQueryResults,
  };
  return { saved, storage, options, store: createQueryDataStore(options) };
}

test('extracts defaults using a custom library and optional host evaluation context', () => {
  const source = [
    '$count = 2',
    'root = Custom(counter)',
    'counter = Query("custom_read", {}, $count)',
    'zero = Query("custom_read", {}, 0)',
    'off = Query("custom_read", {}, false)',
    'empty = Query("custom_read", {}, null)',
  ].join('\n');
  const parsed = parser.parse(source);
  expect(getQueryDefaults(parsed)).toEqual({
    counter: 2,
    zero: 0,
    off: false,
    empty: null,
  });
  expect(
    getQueryDefaults(parsed, {
      context: {
        getState: () => 7,
        resolveRef: () => null,
      },
    }),
  )
    .toEqual({ counter: 7, zero: 0, off: false, empty: null });
  expect(parsed.stateDeclarations).toEqual({ $count: 2 });
});

test('excludes auto-closed streaming tails and conservatively handles missing source', () => {
  const source =
    'ready = Query("read", {}, false)\npartial = Query("read", {}, { count:';
  const parsed = parser.parse(source);
  expect(getQueryDefaults(parsed, { source })).toEqual({ ready: false });
  expect(getQueryDefaults(parsed)).toEqual({});
  const completedQuery = 'ready = Query("read", {}, 0)\nroot = Custom(';
  expect(
    getQueryDefaults(parser.parse(completedQuery), { source: completedQuery }),
  ).toEqual({ ready: 0 });
});

test('restores by scope without writing, preserves prefetches and detaches snapshots', () => {
  const { store, saved, options, storage } = setup();
  expect(store.getInitialQueryResults()).toEqual({});
  saved.set(options.scope, { rows: false, removedQuery: 'ignored' });
  expect(store.getInitialQueryResults({ rows: 'prefetch', other: 0 })).toEqual({
    rows: false,
    other: 0,
  });
  expect(store.query('rows')).toBe(false);
  expect(createQueryDataStore({ ...options, scope: 'another' }).query('rows'))
    .toEqual(options.initialQueryResults.rows);
  saved.clear();
  const first = store.query('rows') as { items: unknown[] };
  first.items.push('outside edit');
  expect(store.query('rows')).toEqual(options.initialQueryResults.rows);
  expect(storage.write).not.toHaveBeenCalled();
});

test('replaces complete values without merging and detaches input and stored snapshots', () => {
  const { store, options, storage, saved } = setup();
  const value = { items: [{ id: 'second', text: 'Edited' }] };
  saved.set(options.scope, { other: false });
  store.mutate('rows', value);
  value.items[0]!.text = 'Outside edit';
  expect(createQueryDataStore(options).query('rows')).toEqual({
    items: [{ id: 'second', text: 'Edited' }],
  });
  expect(saved.get(options.scope)?.other).toBe(false);
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(options.initialQueryResults.rows.items[0]!.text).toBe('First');
  for (const next of [false, 0, null, [], {}, '']) {
    store.mutate('rows', next);
    expect(store.getInitialQueryResults()).toEqual({ rows: next });
  }
});

test('invalid values, unknown keys and storage failures leave saved data unchanged', () => {
  const { store, storage, saved, options } = setup();
  saved.set(options.scope, options.initialQueryResults);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (
    const value of [
      undefined,
      NaN,
      Infinity,
      () => 1,
      { missing: undefined },
      cycle,
    ]
  ) {
    expect(() => store.mutate('rows', value)).toThrow();
    expect(saved.get(options.scope)).toEqual(options.initialQueryResults);
  }
  for (const key of ['unknown', '__proto__', 'constructor']) {
    expect(() => store.mutate(key, 1)).toThrow('Unknown');
    expect(() => store.query(key)).toThrow('Unknown');
  }
  expect(storage.write).not.toHaveBeenCalled();
  storage.write.mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() => store.mutate('rows', false)).toThrow('quota');
  expect(saved.get(options.scope)).toEqual(options.initialQueryResults);
});

test('evaluates native arithmetic into replacement values and refreshes from storage', () => {
  const parsed = parser.parse([
    'root = Custom(counter.count)',
    'counter = Query("openui_query", { key: "counter" }, { count: 0 })',
    'increment = Mutation("openui_mutation", { key: "counter", value: { count: counter.count + 1 } })',
  ].join('\n'));
  expect(parsed.meta.errors).toEqual([]);
  const { options } = setup();
  const store = createQueryDataStore({
    ...options,
    initialQueryResults: getQueryDefaults(parsed),
  });
  for (const count of [1, 2]) {
    const args = evaluate(parsed.mutationStatements[0]!.argsAST, {
      getState: () => null,
      resolveRef: name => store.query(name),
    }) as { key: string; value: unknown };
    store.mutate(args.key, args.value);
    expect(store.query('counter')).toEqual({ count });
    expect(store.getInitialQueryResults()).toEqual({ counter: { count } });
  }
});

test('published data entry loads in Node without a renderer or browser host', () => {
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import { createQueryDataStore, createQueryDataTools, getQueryDefaults } from '@lynx-js/genui/openui/data-tools';
    const store = createQueryDataStore({
      scope: 'headless', initialQueryResults: { counter: 0 },
      storage: { read: () => null, write: () => {} },
    });
    const tools = createQueryDataTools({ call: async () => store.query('counter') });
    tools.setScope('headless');
    tools.publishDefaults('headless', { counter: 0 });
    console.log(JSON.stringify([typeof getQueryDefaults, await tools.tools.openui_query({ key: 'counter' })]));
    tools.dispose();
  `,
  ], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual(['function', 0]);
});
