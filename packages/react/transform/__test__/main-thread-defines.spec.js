// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

function options(target, extra = {}) {
  const isMainThread = target === 'LEPUS';
  return {
    mode: 'test',
    pluginName: '',
    filename: 'test.jsx',
    sourcemap: false,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    directiveDCE: { target },
    defineDCE: {
      define: {
        __LEPUS__: String(isMainThread),
        __MAIN_THREAD__: String(isMainThread),
        __JS__: String(!isMainThread),
        __BACKGROUND__: String(!isMainThread),
      },
    },
    worklet: {
      target,
      filename: 'test.jsx',
      runtimePkg: '@lynx-js/react/internal',
    },
    snapshot: {
      preserveJsx: false,
      runtimePkg: '@lynx-js/react/internal',
      jsxImportSource: isMainThread ? '@lynx-js/react/lepus' : '@lynx-js/react',
      target,
      filename: 'test',
    },
    ...extra,
  };
}

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
  it('collects the definitions the main thread needs while compiling the background', async () => {
    const result = await transformReactLynx(
      source,
      options('JS', { collectMainThreadDefines: true }),
    );

    expect(result.mainThreadDefines).toHaveLength(2);
    const [worklet, snapshot] = result.mainThreadDefines;

    expect(worklet.kind).toBe('worklet');
    expect(worklet.code).toContain('registerWorkletInternal');
    expect(worklet.code).toContain('loadWorkletRuntime');
    expect(worklet.code).toContain('this["_c"]');

    expect(snapshot.kind).toBe('snapshot');
    expect(snapshot.id).toMatch(/^__snapshot_/);
    expect(snapshot.code).toContain('ReactLynx.createSnapshot');
    expect(snapshot.code).toContain('__CreateView');
    expect(result.code).not.toContain('__CreateView');
  });

  it('collects the same definitions the main-thread transform would emit', async () => {
    const fromBackground = await transformReactLynx(
      source,
      options('JS', { collectMainThreadDefines: true }),
    );
    const fromMainThread = await transformReactLynx(
      source,
      options('LEPUS', { collectMainThreadDefines: true }),
    );

    expect(fromBackground.mainThreadDefines).toStrictEqual(
      fromMainThread.mainThreadDefines,
    );
  });

  it('hygienes each definition on its own', async () => {
    const { mainThreadDefines } = await transformReactLynx(
      source,
      options('JS', { collectMainThreadDefines: true }),
    );

    const snapshot = mainThreadDefines.find(({ kind }) => kind === 'snapshot');
    expect(snapshot.code).toContain('const el = __CreateView');
    expect(snapshot.code).toContain('const el1 = __CreateText');
    expect(snapshot.code).toContain('__AppendElement(el, el1)');
  });

  it('is disabled by default and leaves the normal output unchanged', async () => {
    const result = await transformReactLynx(source, options('JS'));

    expect(result.mainThreadDefines).toBeUndefined();
    expect(result.code).toContain('snapshotCreatorMap');
  });

  it('lowers the definitions to the main thread syntax baseline', async () => {
    const result = await transformReactLynx(
      `
export function App() {
  function onTap(e) {
    'main thread';
    e.target?.setStyleProperty('a', 'b');
    const v = e.detail ?? 0;
    class Value { current = v; }
    console.info(new Value().current);
  }
  return <view main-thread:bindtap={onTap} />;
}
`,
      options('JS', { collectMainThreadDefines: true }),
    );

    const code = result.mainThreadDefines.map(define => define.code).join('\n');
    expect(code).not.toContain('?.');
    expect(code).not.toContain('??');
    expect(code).not.toContain('current = v');
    expect(code).not.toContain('@swc/helpers');
  });
});
