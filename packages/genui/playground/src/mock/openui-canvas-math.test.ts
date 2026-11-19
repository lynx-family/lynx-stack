// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runInNewContext } from 'node:vm';

import { createParser, evaluateElementProps } from '@openuidev/lang-core';
import type { ElementNode, OpenUIError } from '@openuidev/lang-core';
import { expect, test } from '@rstest/core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui/openui/prompt';

import { OPENUI_CANVAS_MATH_RAW } from './openui-canvas-math.js';

const library = createOpenUiPromptLibrary();
const parsed = createParser(library.toJSONSchema(), library.root).parse(
  OPENUI_CANVAS_MATH_RAW,
);

test.each([
  { state: {}, x: 111, y: 129 },
  { state: { $amplitude: 2 }, x: 111, y: 93 },
  { state: { $frequency: 2 }, x: 111, y: 165 },
  { state: { $phase: 90 }, x: 111, y: 165 },
  { state: { $sample: 180 }, x: 186, y: 165 },
  {
    state: { $amplitude: 2, $frequency: 3, $phase: -180, $sample: 360 },
    x: 336,
    y: 165,
  },
])('plots the sine probe for state $state', ({ state, x, y }) => {
  const values: Record<string, unknown> = state;
  const errors: OpenUIError[] = [];
  const root = evaluateElementProps(parsed.root!, {
    library,
    store: null,
    ctx: {
      resolveRef: () => undefined,
      getState: name => values[name] ?? parsed.stateDeclarations[name],
    },
    errors,
  });
  expect(errors).toEqual([]);
  const children = root.props.children as ElementNode[];
  const graph = children.find(child => child.typeName === 'Canvas')!;
  const points: number[][] = [];
  const ctx = new Proxy({}, {
    get: (_, method) => (...args: unknown[]) => {
      for (const arg of args) {
        if (typeof arg === 'number') expect(Number.isFinite(arg)).toBe(true);
      }
      if (method === 'arc') points.push(args as number[]);
    },
  });
  runInNewContext(graph.props.code as string, { ctx, width: 360, height: 358 });
  expect(points).toHaveLength(1);
  expect(points[0]![0]).toBeCloseTo(x);
  expect(points[0]![1]).toBeCloseTo(y);
});
