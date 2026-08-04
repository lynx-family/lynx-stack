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
    expect(snapshot.code).toContain('var el = __CreateView');
    expect(snapshot.code).toContain('var el1 = __CreateText');
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
    expect(code).not.toContain('const ');
    expect(code).not.toContain('current = v');
    expect(code).not.toContain('@swc/helpers');
  });
});

function legacy(target, extra = {}) {
  return options(target, {
    snapshot: { ...options(target).snapshot, legacySlot: true },
    ...extra,
  });
}

describe('legacy slot codegen', () => {
  it('collects the definitions its frozen codegen emits', async () => {
    const { mtsDefines } = await transformReactLynx(source, legacy('JS', { collectMTSDefines: true }));

    const snapshot = mtsDefines.find(({ kind }) => kind === 'snapshot');
    expect(snapshot.code).toContain('__CreateView');
    expect(snapshot.code).toContain('__CreateText');
    expect(mtsDefines.some(({ kind }) => kind === 'worklet')).toBe(true);
  });

  it('collects the same definitions the main-thread transform would emit', async () => {
    const fromBackground = await transformReactLynx(source, legacy('JS', { collectMTSDefines: true }));
    const fromMainThread = await transformReactLynx(source, legacy('LEPUS', { collectMTSDefines: true }));

    expect(fromBackground.mtsDefines).toStrictEqual(fromMainThread.mtsDefines);
  });

  it('leaves the emitted background code unchanged', async () => {
    const withCollect = await transformReactLynx(source, legacy('JS', { collectMTSDefines: true }));
    const withoutCollect = await transformReactLynx(source, legacy('JS'));

    expect(withCollect.code).toBe(withoutCollect.code);
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

  it('rewrites references in a collected define to registry lookups', async () => {
    const result = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.sharedImports).toHaveLength(1);
    const [{ id, request }] = result.sharedImports;
    expect(request).toBe('./foo.js');

    const worklet = result.mtsDefines.find(({ kind }) => kind === 'worklet');
    expect(worklet.code).toContain(
      `var _$sharedModule = getSharedModule("${id}");`,
    );
    expect(worklet.code).toContain('new _$sharedModule.Foo()');
    expect(worklet.code).not.toContain('this["_c"]');
  });

  it('caches each shared module once per worklet and maps every import form', async () => {
    const result = await transformReactLynx(
      `
import Curve, * as NS from './physics.js' with { runtime: 'shared' };
import { spring, damping as d } from './physics.js' with { runtime: 'shared' };

function f(e) {
  'main thread';
  return Curve + NS.gravity + spring(e) + d + { spring };
}
`,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.sharedImports).toHaveLength(1);
    const [{ id }] = result.sharedImports;

    const worklet = result.mtsDefines.find(({ kind }) => kind === 'worklet');
    const lookups = worklet.code.match(/getSharedModule\(/g);
    expect(lookups).toHaveLength(1);
    expect(worklet.code).toContain(`getSharedModule("${id}")`);
    expect(worklet.code).toContain('_$sharedModule.default');
    expect(worklet.code).toContain('_$sharedModule.gravity');
    expect(worklet.code).toContain('_$sharedModule.spring(e)');
    expect(worklet.code).toContain('_$sharedModule.damping');
    expect(worklet.code).toContain('spring: _$sharedModule.spring');
  });

  it('reports only the shared imports a collected define references', async () => {
    const result = await transformReactLynx(
      `
import { used } from './used.js' with { runtime: 'shared' };
import { unused } from './unused.js' with { runtime: 'shared' };

export function App() {
  function onTap() {
    'main thread';
    used();
  }
  unused();
  return <view main-thread:bindtap={onTap} />;
}
`,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.sharedImports).toHaveLength(1);
    expect(result.sharedImports[0].request).toBe('./used.js');
  });

  it('keeps the emitted background code unchanged', async () => {
    const withCollect = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );
    const withoutCollect = await transformReactLynx(sharedSource, options('JS'));

    expect(withCollect.code).toBe(withoutCollect.code);
  });

  it('derives the same registry id for the same importer and request', async () => {
    const first = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );
    const second = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );

    expect(first.sharedImports).toStrictEqual(second.sharedImports);
  });
});
