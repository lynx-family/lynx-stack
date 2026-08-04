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

  it('fails the build while collecting, where the main thread has no binding for it', async () => {
    const result = await transformReactLynx(
      sharedSource,
      options('JS', { collectMTSDefines: true }),
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].text).toMatch(/runtime: 'shared'/);
  });
});

describe('root <Background> fold on the main thread', () => {
  const entry = `
import { root, Background } from "@lynx-js/react";
import { HeavyApp } from "./HeavyApp.jsx";
import { Skeleton } from "./Skeleton.jsx";

root.render(
  <page>
    <Background fallback={<Skeleton />}>
      <HeavyApp />
    </Background>
  </page>,
);
`;

  const fold = (source, target = 'LEPUS') =>
    transformReactLynx(source, options(target, { foldBackgroundToFallback: true }));

  it('renders the fallback and drops the deferred subtree', async () => {
    const { code } = await fold(entry);

    expect(code).toContain('Skeleton');
    expect(code).not.toContain('HeavyApp');
    // The host wrapper around the boundary is untouched.
    expect(code).toContain('ReactLynxRuntimeComponents.Page');
  });

  it('keeps a component fallback as a component, not a snapshot', async () => {
    const { code } = await fold(entry);

    expect(code).toMatch(/_jsx\(Skeleton, \{\s*\}\)/);
  });

  it('follows an aliased import', async () => {
    const { code } = await fold(`
import { root, Background as Boundary } from "@lynx-js/react";
import { HeavyApp } from "./HeavyApp.jsx";
import { Skeleton } from "./Skeleton.jsx";
root.render(<Boundary fallback={<Skeleton />}><HeavyApp /></Boundary>);
`);

    expect(code).toContain('Skeleton');
    expect(code).not.toContain('HeavyApp');
  });

  it('ignores a `Background` that is not the runtime one', async () => {
    const { code } = await fold(`
import { root } from "@lynx-js/react";
import { Background } from "./my-background.jsx";
import { HeavyApp } from "./HeavyApp.jsx";
root.render(<Background fallback={null}><HeavyApp /></Background>);
`);

    expect(code).toContain('HeavyApp');
  });

  it('folds a nested <Background> to its own fallback', async () => {
    const { code } = await fold(`
import { root, Background } from "@lynx-js/react";
import { HeavyApp } from "./HeavyApp.jsx";
import { Skeleton } from "./Skeleton.jsx";
root.render(
  <Background fallback={<Background fallback={<Skeleton />}><HeavyApp /></Background>}>
    <HeavyApp />
  </Background>,
);
`);

    expect(code).toContain('Skeleton');
    expect(code).not.toContain('HeavyApp');
  });

  it('renders nothing when the boundary declares no fallback', async () => {
    const { code } = await fold(`
import { root, Background } from "@lynx-js/react";
import { HeavyApp } from "./HeavyApp.jsx";
root.render(<Background><HeavyApp /></Background>);
`);

    expect(code).toContain('root.render(null)');
    expect(code).not.toContain('HeavyApp');
  });

  it('fails the build on a spread it cannot resolve', async () => {
    const result = await fold(`
import { root, Background } from "@lynx-js/react";
import { HeavyApp } from "./HeavyApp.jsx";
const props = { fallback: null };
root.render(<Background {...props}><HeavyApp /></Background>);
`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].text).toMatch(/spread on `<Background>`/);
  });

  it('leaves the background target alone', async () => {
    const { code } = await transformReactLynx(entry, options('JS'));

    expect(code).toContain('HeavyApp');
    expect(code).toContain('Background');
  });
});
