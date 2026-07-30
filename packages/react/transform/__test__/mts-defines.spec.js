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

describe('collectMTSDefines', () => {
  it('collects the definitions the main thread needs while compiling the background', async () => {
    const result = await transformReactLynx(
      source,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.mtsDefines).toHaveLength(2);
    const [worklet, snapshot] = result.mtsDefines;

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
      options('JS', { collectMTSDefines: true }),
    );
    const fromMainThread = await transformReactLynx(
      source,
      options('LEPUS', { collectMTSDefines: true }),
    );

    expect(fromBackground.mtsDefines).toStrictEqual(
      fromMainThread.mtsDefines,
    );
  });

  it('hygienes each definition on its own', async () => {
    const { mtsDefines } = await transformReactLynx(
      source,
      options('JS', { collectMTSDefines: true }),
    );

    const snapshot = mtsDefines.find(({ kind }) => kind === 'snapshot');
    expect(snapshot.code).toContain('const el = __CreateView');
    expect(snapshot.code).toContain('const el1 = __CreateText');
    expect(snapshot.code).toContain('__AppendElement(el, el1)');
  });

  it('is disabled by default and leaves the normal output unchanged', async () => {
    const result = await transformReactLynx(source, options('JS'));

    expect(result.mtsDefines).toBeUndefined();
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
      options('JS', { collectMTSDefines: true }),
    );

    const code = result.mtsDefines.map(define => define.code).join('\n');
    expect(code).not.toContain('?.');
    expect(code).not.toContain('??');
    expect(code).not.toContain('current = v');
    expect(code).not.toContain('@swc/helpers');
  });
});

describe('shared runtime imports', () => {
  const sharedSource = `
import { Foo } from './foo.js' with { runtime: 'shared' };

function f() {
  'main thread';
  return new Foo();
}
`;

  it('is left to the bundler when the main thread compiles business code', async () => {
    const result = await transformReactLynx(sharedSource, options('LEPUS'));

    expect(result.code).toContain('new Foo()');
  });

  it('fails the build while collecting, where the main thread has no binding for it', async () => {
    const result = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].text).toMatch(/runtime: 'shared'/);
  });
});
