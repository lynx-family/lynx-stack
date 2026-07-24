// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const baseOptions = {
  mode: 'test',
  pluginName: '',
  filename: 'test.jsx',
  sourcemap: false,
  cssScope: false,
  directiveDCE: { target: 'LEPUS' },
  defineDCE: {
    define: {
      __LEPUS__: 'true',
      __MAIN_THREAD__: 'true',
      __JS__: 'false',
      __BACKGROUND__: 'false',
    },
  },
  shake: false,
  compat: false,
  worklet: {
    target: 'LEPUS',
    filename: 'test.jsx',
    runtimePkg: '@lynx-js/react/internal',
  },
  refresh: false,
  snapshot: {
    preserveJsx: false,
    runtimePkg: '@lynx-js/react/internal',
    jsxImportSource: '@lynx-js/react/lepus',
    target: 'LEPUS',
    filename: 'test',
  },
};

const source = `
import { useState } from "@lynx-js/react";

const label = "hi";

export function App() {
  const [count, setCount] = useState(0);
  function onScroll(e) {
    'main thread';
    console.info(label, e);
  }
  return (
    <view main-thread:bindscroll={onScroll}>
      <text bindtap={() => setCount(count + 1)}>{count}</text>
    </view>
  );
}
`;

describe('collectMainThreadDefines', () => {
  it('collects snapshot + worklet registrations into mainThreadDefines', async () => {
    const result = await transformReactLynx(source, {
      ...baseOptions,
      collectMainThreadDefines: true,
    });

    expect(result.mainThreadDefines).toBeTypeOf('string');
    // Snapshot registration: id decl + creator map assignment referencing the
    // `ReactLynx` runtime import binding by name.
    expect(result.mainThreadDefines).toContain('snapshotCreatorMap');
    expect(result.mainThreadDefines).toContain('ReactLynx.createSnapshot');
    // Worklet registration + its runtime boot.
    expect(result.mainThreadDefines).toContain('registerWorkletInternal');
    expect(result.mainThreadDefines).toContain('loadWorkletRuntime');
    // The worklet keeps its captured module binding via the `_c` closure.
    expect(result.mainThreadDefines).toContain('this["_c"]');
  });

  it('hygienes the collected creator so element locals stay distinct', async () => {
    const result = await transformReactLynx(source, {
      ...baseOptions,
      collectMainThreadDefines: true,
    });

    // The creator builds a `view` wrapping a `text`; the two element locals
    // must not collapse onto the same name after being collected pre-hygiene.
    expect(result.mainThreadDefines).toContain('const el = __CreateView');
    expect(result.mainThreadDefines).toContain('const el1 = __CreateText');
    expect(result.mainThreadDefines).toContain('__AppendElement(el, el1)');
  });

  it('is disabled by default and leaves the normal output unchanged', async () => {
    const result = await transformReactLynx(source, baseOptions);

    expect(result.mainThreadDefines).toBeUndefined();
    // The registrations are still emitted inline in the normal output.
    expect(result.code).toContain('snapshotCreatorMap');
    expect(result.code).toContain('registerWorkletInternal');
  });
});
