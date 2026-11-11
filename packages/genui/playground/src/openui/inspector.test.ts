// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import {
  cacheOpenUIQueryDefaults,
  readOpenUIParsedJSON,
  readOpenUIQueryDefaults,
  receiveOpenUIQueryDefaults,
} from './inspector.js';
import { OPENUI_QUERY_DEFAULTS } from '../../lynx-src/openui/dataTools.js';
import { OPENUI_CHAT_ADAPTER } from '../pages/chat/openui.js';

test('defers inspector reads until selection and reuses defaults reported by the renderer', () => {
  const rawText =
    'counter = Query("openui_query", { key: "counter" }, 1)\nroot = Text("Lazy")';
  const artifact = OPENUI_CHAT_ADAPTER.preview.artifact({
    rawText,
    scenarioTitle: '',
  });
  expect(artifact.views[0]!.text).toBe(rawText);
  // Delivery can happen after artifact creation and before a data tab is opened.
  const defaults = { counter: 0, enabled: false, selection: null, items: [] };
  expect(
    receiveOpenUIQueryDefaults({
      type: OPENUI_QUERY_DEFAULTS,
      rawText,
      defaults,
    }),
  ).toBe(true);
  expect(JSON.parse(artifact.views.find(view => view.id === 'data')!.text))
    .toEqual(defaults);
  expect(readOpenUIQueryDefaults(rawText)).toBe(defaults);
});

test('shares one fallback result across Query data and JSON inspections without a preview', () => {
  const source =
    'count = Query("openui_query", { key: "count" }, 2)\nroot = Text("Fallback")';
  const defaults = readOpenUIQueryDefaults(source);
  expect(defaults).toEqual({ count: 2 });
  expect(JSON.parse(readOpenUIParsedJSON(source))).toHaveProperty(
    'queryStatements',
  );
  expect(readOpenUIQueryDefaults(source)).toBe(defaults);
  const other = source + '\n// separate artifact';
  cacheOpenUIQueryDefaults(other, { count: 5 });
  expect(readOpenUIQueryDefaults(source)).toEqual({ count: 2 });
  expect(readOpenUIQueryDefaults(other)).toEqual({ count: 5 });
});

test('preserves independent inline programs in the JSON inspector', () => {
  const source =
    'Intro\n```openui\nroot = Text("One")\nfirst = Query("openui_query", { key: "first" }, false)\n```\n```openui\nroot = Text("Two")\nsecond = Query("openui_query", { key: "second" }, 0)\n```';
  const parts = JSON.parse(readOpenUIParsedJSON(source)) as Array<
    { kind: string; result?: { queryStatements: unknown[] } }
  >;
  expect(
    parts.filter(part => part.kind === 'code').map(part =>
      part.result?.queryStatements.length
    ),
  ).toEqual([1, 1]);
  expect(readOpenUIQueryDefaults(source)).toEqual({ first: false, second: 0 });
});
