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

describe('collected defines', () => {
  it('collects the definitions the main thread needs while compiling the background', async () => {
    const result = await transformReactLynx(
      source,
      options('JS'),
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react/internal";
      import { useState } from "@lynx-js/react";
      const label = "hi";
      const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, null, null, [
              [
                  ReactLynx.__DynamicPartSlotV2,
                  1
              ]
          ], undefined, globDynamicComponentEntry, null, true);
      export function App() {
          const [count, setCount] = useState(0);
          let onScroll = {
              _c: {
                  label
              },
              _wkltId: "d3dd:test:1"
          };
          return /*#__PURE__*/ _jsx(__snapshot_a94a8_test_1, {
              values: [
                  onScroll,
                  ()=>setCount(count + 1)
              ],
              $0: count
          });
      }
      ",
        "definesForSnapshot": [
          {
            "code": "const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              const el1 = __CreateText(pageId);
              __AppendElement(el, el1);
              return [
                  el,
                  el1
              ];
          }, [
              (snapshot, index, oldValue)=>ReactLynx.updateWorkletEvent(snapshot, index, oldValue, 0, "main-thread", "bindEvent", "scroll"),
              (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 1, "bindEvent", "tap", '')
          ], [
              [
                  ReactLynx.__DynamicPartSlotV2,
                  1
              ]
          ], undefined, globDynamicComponentEntry, null, true);
      ",
            "id": "__snapshot_a94a8_test_1",
          },
        ],
        "definesForWorklet": [
          {
            "code": "const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "d3dd:test:1", function(e) {
          const onScroll = lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          let { label } = this["_c"];
          'main thread';
          console.info(label, e);
      });
      ",
            "id": "d3dd:test:1",
          },
        ],
        "errors": [],
        "uiSourceMapRecords": [],
        "warnings": [],
      }
    `);

    expect(result.definesForWorklet).toHaveLength(1);
    expect(result.definesForSnapshot).toHaveLength(1);
    const [worklet] = result.definesForWorklet;
    const [snapshot] = result.definesForSnapshot;
    expect(worklet.code).toContain('registerWorkletInternal');
    expect(worklet.code).toContain('loadWorkletRuntime');
    expect(worklet.code).toContain('this["_c"]');
    expect(snapshot.id).toMatch(/^__snapshot_/);
    expect(snapshot.code).toContain('ReactLynx.createSnapshot');
    expect(snapshot.code).toContain('__CreateView');
    expect(result.code).not.toContain('__CreateView');
  });

  it('collects the same definitions the main-thread transform would emit', async () => {
    const fromBackground = await transformReactLynx(
      source,
      options('JS'),
    );
    const fromMainThread = await transformReactLynx(
      source,
      options('LEPUS'),
    );

    expect(fromBackground.definesForSnapshot).toStrictEqual(
      fromMainThread.definesForSnapshot,
    );
    expect(fromBackground.definesForWorklet).toStrictEqual(
      fromMainThread.definesForWorklet,
    );
  });

  it('hygienes each definition on its own', async () => {
    const { definesForSnapshot } = await transformReactLynx(
      source,
      options('JS'),
    );

    expect(definesForSnapshot[0].code).toMatchInlineSnapshot(`
      "const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              const el1 = __CreateText(pageId);
              __AppendElement(el, el1);
              return [
                  el,
                  el1
              ];
          }, [
              (snapshot, index, oldValue)=>ReactLynx.updateWorkletEvent(snapshot, index, oldValue, 0, "main-thread", "bindEvent", "scroll"),
              (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 1, "bindEvent", "tap", '')
          ], [
              [
                  ReactLynx.__DynamicPartSlotV2,
                  1
              ]
          ], undefined, globDynamicComponentEntry, null, true);
      "
    `);
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
    const { definesForSnapshot, definesForWorklet } = await transformReactLynx(
      source,
      legacy('JS'),
    );

    expect({ definesForSnapshot, definesForWorklet }).toMatchInlineSnapshot(`
      {
        "definesForSnapshot": [
          {
            "code": "const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              const el1 = __CreateText(pageId);
              __AppendElement(el, el1);
              return [
                  el,
                  el1
              ];
          }, [
              (snapshot, index, oldValue)=>ReactLynx.updateWorkletEvent(snapshot, index, oldValue, 0, "main-thread", "bindEvent", "scroll"),
              (snapshot, index, oldValue)=>ReactLynx.updateEvent(snapshot, index, oldValue, 1, "bindEvent", "tap", '')
          ], [
              [
                  ReactLynx.__DynamicPartChildren,
                  1
              ]
          ], undefined, globDynamicComponentEntry, null, true);
      ",
            "id": "__snapshot_a94a8_test_1",
          },
        ],
        "definesForWorklet": [
          {
            "code": "const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "d3dd:test:1", function(e) {
          const onScroll = lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          let { label } = this["_c"];
          'main thread';
          console.info(label, e);
      });
      ",
            "id": "d3dd:test:1",
          },
        ],
      }
    `);
  });

  it('collects the same definitions the main-thread transform would emit', async () => {
    const fromBackground = await transformReactLynx(source, legacy('JS'));
    const fromMainThread = await transformReactLynx(source, legacy('LEPUS'));

    expect(fromBackground.definesForSnapshot).toStrictEqual(
      fromMainThread.definesForSnapshot,
    );
    expect(fromBackground.definesForWorklet).toStrictEqual(
      fromMainThread.definesForWorklet,
    );
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

    expect(result.code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react/internal";
      var loadWorkletRuntime = __loadWorkletRuntime;
      import { Foo } from './foo.js' with {
          runtime: 'shared'
      };
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "d3dd:test:1", function() {
          lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          'main thread';
          return new Foo();
      });
      "
    `);
  });

  it('skips collecting a worklet that closes over a shared binding', async () => {
    const result = await transformReactLynx(
      sharedSource,
      options('JS'),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.definesForSnapshot).toEqual([]);
    expect(result.definesForWorklet).toEqual([]);
  });
});
