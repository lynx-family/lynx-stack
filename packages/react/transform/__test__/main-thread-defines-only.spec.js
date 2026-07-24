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
  mainThreadDefinesOnly: true,
  snapshot: {
    preserveJsx: false,
    runtimePkg: '@lynx-js/react/internal',
    jsxImportSource: '@lynx-js/react/lepus',
    target: 'LEPUS',
    filename: 'test',
  },
};

describe('mainThreadDefinesOnly', () => {
  it('should replace the module with imports and defines', async () => {
    const result = await transformReactLynx(
      `
import { useState } from "@lynx-js/react";
import { track } from "my-monitor";
import './style.css';
export { helper } from './helper.js';

track("side-effect");

export function App() {
  const [count, setCount] = useState(0);
  function onScroll(e) {
    'main thread';
    console.info(e);
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

    expect(result.code).toContain(
      'import * as ReactLynx from "@lynx-js/react/internal"',
    );
    expect(result.code).toContain('ReactLynx.snapshotCreatorMap');
    expect(result.code).toContain('registerWorkletInternal');
    expect(result.code).toContain(`import "my-monitor"`);
    expect(result.code).toContain(`import './style.css'`);
    expect(result.code).toContain(`import './helper.js'`);
    expect(result.code).not.toContain('useState');
    expect(result.code).not.toContain('track(');
    expect(result.code).not.toContain('function App');
    expect(result.code).toMatchSnapshot();
  });

  it('should keep dynamic imports dynamic behind a runtime-false guard', async () => {
    const result = await transformReactLynx(
      `
export function App() {
  const load = () => import('./lazy-comp.jsx');
  return <view bindtap={load} />;
}
`,
      options,
    );

    expect(result.code).toMatchSnapshot();
    // The dynamic import stays dynamic so webpack keeps the lazy bundle split
    // (its own main-thread section), but is guarded so it never runs on the
    // main thread, which renders nothing in this mode.
    expect(result.code).toContain('__lynxKeepLazyBundle');
    expect(result.code).toContain(`import('./lazy-comp.jsx')`);
    expect(result.code).not.toContain('import "./lazy-comp.jsx"');
  });

  it('should keep only side-effect imports for modules without defines', async () => {
    const result = await transformReactLynx(
      `
import { report } from './sdk.js';

report('module-side-effect');
`,
      options,
    );

    expect(result.code).toContain(`import './sdk.js'`);
    expect(result.code).not.toContain('report(');
  });

  it('should keep the full output when disabled', async () => {
    const result = await transformReactLynx(
      `
import { useState } from "@lynx-js/react";

export function App() {
  const [count] = useState(0);
  return <view><text>{count}</text></view>;
}
`,
      { ...options, mainThreadDefinesOnly: false },
    );

    expect(result.code).toContain('function App');
    expect(result.code).toContain('snapshotCreatorMap');
  });
});
