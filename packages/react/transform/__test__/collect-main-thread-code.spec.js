// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

const options = {
  mode: 'test',
  pluginName: '',
  filename: 'test.jsx',
  sourcemap: false,
  cssScope: false,
  jsx: true,
  directiveDCE: { target: 'LEPUS' },
  defineDCE: {
    define: {
      __LEPUS__: 'true',
      __MAIN_THREAD__: 'true',
      __JS__: 'false',
      __BACKGROUND__: 'false',
    },
  },
  shake: true,
  compat: false,
  worklet: {
    target: 'LEPUS',
    filename: 'test.jsx',
    runtimePkg: '@lynx-js/react/internal',
  },
  refresh: false,
  collectMainThreadCode: true,
  snapshot: {
    preserveJsx: false,
    runtimePkg: '@lynx-js/react/internal',
    jsxImportSource: '@lynx-js/react/lepus',
    target: 'LEPUS',
    filename: 'test',
  },
};

describe('collectMainThreadCode', () => {
  it('should collect snapshot and worklet registrations without changing the output', async () => {
    const result = await transformReactLynx(
      `
import { useState } from "@lynx-js/react";

export function App() {
  const [count, setCount] = useState(0);
  function onScroll(e) {
    'main thread';
    console.log(e);
  }
  return (
    <view main-thread:bindscroll={onScroll}>
      <text bindtap={() => setCount(count + 1)}>{count}</text>
    </view>
  );
}
`,
      options,
    );

    expect(result.mainThreadCode).toContain('snapshotCreatorMap');
    expect(result.mainThreadCode).toContain('registerWorkletInternal');
    expect(result.mainThreadCode).not.toContain('useState');
    // The transformed output is unchanged.
    expect(result.code).toContain('function App');
    expect(result.code).toContain('snapshotCreatorMap');
    expect(result.mainThreadCode).toMatchSnapshot();
  });

  it('should keep imports of modules only rendered by the background thread', async () => {
    const result = await transformReactLynx(
      `
import Counter from "./comp-lib/index.jsx";

export function App() {
  return <view>{__MAIN_THREAD__ ? null : <Counter />}</view>;
}
`,
      options,
    );

    // `Counter` is unused after \`__MAIN_THREAD__\` is folded, but the module
    // must stay in the main-thread module graph so its own snapshot
    // registrations are collected.
    expect(result.code).toContain('import "./comp-lib/index.jsx"');
  });

  it('should not collect when disabled', async () => {
    const result = await transformReactLynx(
      `
export function App() {
  return <view />;
}
`,
      { ...options, collectMainThreadCode: false },
    );

    expect(result.mainThreadCode).toBeUndefined();
    expect(result.code).toContain('snapshotCreatorMap');
  });
});
