// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

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
            "code": "__registerWorklet("main-thread", "d3dd:test:1", function(e) {
          const onScroll = lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          let { label } = this["_c"];
          console.info(label, e);
      });
      ",
            "id": "d3dd:test:1",
            "imports": [
              {
                "imported": "registerWorklet",
                "local": "__registerWorklet",
                "source": "@lynx-js/react/worklet-runtime/init",
              },
            ],
            "runtimeRequirements": {
              "mainThreadProgrammability": true,
            },
          },
        ],
        "errors": [],
        "runtimeRequirements": {
          "mainThreadProgrammability": false,
        },
        "uiSourceMapRecords": [],
        "warnings": [],
      }
    `);

    expect(result.definesForWorklet).toHaveLength(1);
    expect(result.definesForSnapshot).toHaveLength(1);
    const [worklet] = result.definesForWorklet;
    const [snapshot] = result.definesForSnapshot;
    expect(worklet.code).toContain('__registerWorklet');
    expect(worklet.imports).toEqual([{
      source: '@lynx-js/react/worklet-runtime/init',
      imported: 'registerWorklet',
      local: '__registerWorklet',
    }]);
    expect(worklet.code).not.toContain('loadWorkletRuntime');
    expect(worklet.runtimeRequirements).toEqual({
      mainThreadProgrammability: true,
    });
    expect(result.runtimeRequirements.mainThreadProgrammability).toBe(false);
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

  it.each(['JS', 'LEPUS'])('carries hygienic custom runtime imports with %s definitions', async target => {
    const result = await transformReactLynx(
      `
      export function handler(__registerWorklet) {
        'main thread';
        return __registerWorklet + 1;
      }
    `,
      options(target, {
        worklet: { target, filename: 'test.jsx', runtimePkg: '@custom/react/internal' },
      }),
    );
    expect(result.errors).toEqual([]);
    const [definition] = result.definesForWorklet;
    const [dependency] = definition.imports;
    expect(dependency.source).toBe('@custom/react/worklet-runtime/init');
    expect(dependency.imported).toBe('registerWorklet');
    expect(definition.code).toContain(`${dependency.local}("main-thread"`);
    const registrations = [];
    new Function(dependency.local, definition.code)((...args) => registrations.push(args));
    expect(registrations).toHaveLength(1);
    // Execute the lowered body as well as the call site to catch capture by
    // an authored parameter with the compiler's preferred helper name.
    const [type, id, fn] = registrations[0];
    expect(type).toBe('main-thread');
    const oldImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = { _workletMap: { [id]: fn } };
    try {
      expect(fn.call({ _c: {} }, 41)).toBe(42);
    } finally {
      globalThis.lynxWorkletImpl = oldImpl;
    }
    if (target === 'JS') expect(result.code).not.toContain('/worklet-runtime/init');
    const injected = await transformReactLynx(
      `import { ${dependency.imported} as ${dependency.local} } from '${dependency.source}';\n${definition.code}`,
      options('LEPUS'),
    );
    expect(injected.errors).toEqual([]);
    expect(injected.definesForWorklet).toEqual([]);
    expect(injected.code.match(/registerWorklet as/g)).toHaveLength(1);
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

describe('worklet definition imports', () => {
  const source = `
import { runOnBackground, useState } from '@lynx-js/react';
export function Repro() {
  const [count, setCount] = useState(0);
  const onTap = () => {
    'main thread';
    runOnBackground(() => {
      'background only';
      setCount(value => value + 1);
    })();
  };
  return <view main-thread:bindtap={onTap}>{count}</view>;
}
`;

  it.each(['test', 'development'])(
    'carries the runOnBackground import without unrelated component imports in %s mode',
    async (mode) => {
      const background = await transformReactLynx(source, options('JS', { mode }));
      const mainThread = await transformReactLynx(source, options('LEPUS', { mode }));
      expect(background.errors).toEqual([]);
      expect(background.definesForWorklet).toEqual(mainThread.definesForWorklet);
      const [definition] = background.definesForWorklet;
      const dependency = definition.imports.find(item => item.imported === 'runOnBackground');
      expect(dependency).toEqual({ source: '@lynx-js/react', imported: 'runOnBackground', local: dependency.local });
      expect(definition.code).toContain(`${dependency.local}(_jsFn1)()`);
      expect(definition.imports.some(item => item.imported === 'useState')).toBe(false);
    },
  );

  it('resolves Windows relative imports in the Wasm transform', async () => {
    const result = await transformReactLynx(
      source.replace('\'@lynx-js/react\'', '\'./bridge.js\''),
      options('JS', { filename: 'C:\\project\\src\\Repro.jsx' }),
    );
    expect(result.errors).toEqual([]);
    expect(result.definesForWorklet[0].imports).toContainEqual(
      expect.objectContaining({ source: 'C:/project/src/./bridge.js', imported: 'runOnBackground' }),
    );
  });

  it('resolves relative imports from the owning module directory', async () => {
    const filename = path.resolve('src/components/Repro.jsx');
    const result = await transformReactLynx(
      source.replace('\'@lynx-js/react\'', '\'./bridge.js\''),
      options('JS', { filename }),
    );
    expect(result.errors).toEqual([]);
    expect(result.definesForWorklet[0].imports).toContainEqual(expect.objectContaining({
      source: `${path.dirname(filename)}/./bridge.js`.replaceAll('\\', '/'),
      imported: 'runOnBackground',
    }));
  });

  it('does not import bindings captured through the worklet context', async () => {
    const result = await transformReactLynx(
      `
import { value } from './values.js';
function worklet() { 'main thread'; return value; }
`,
      options('JS'),
    );
    expect(result.errors).toEqual([]);
    expect(result.definesForWorklet[0].imports).toHaveLength(1);
    expect(result.definesForWorklet[0].code).toContain('this["_c"]');
  });

  it('preserves default, namespace and aliased imports and shorthand keys', async () => {
    const opts = options('JS');
    opts.worklet.customGlobalIdentNames = ['call', 'api', 'named'];
    const result = await transformReactLynx(
      `
import call, * as api from './bridge.js';
import { original as named } from './other.js';
function worklet() { 'main thread'; return [call(), api.value, { named }]; }
`,
      opts,
    );
    expect(result.errors).toEqual([]);
    const [definition] = result.definesForWorklet;
    expect(definition.imports).toEqual(expect.arrayContaining([
      { source: './bridge.js', imported: 'default', local: 'call' },
      { source: './bridge.js', imported: '*', local: 'api', namespace: true },
      { source: './other.js', imported: 'original', local: 'named' },
    ]));
    expect(definition.code).toContain('named');
  });

  it('does not carry an import shadowed by a worklet parameter', async () => {
    const result = await transformReactLynx(
      `
import { runOnBackground } from './bridge.js';
function worklet(runOnBackground) {
  'main thread';
  runOnBackground(() => {})();
}
`,
      options('JS'),
    );
    expect(result.errors).toEqual([]);
    expect(result.definesForWorklet[0].imports).toHaveLength(1);
  });
});

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
            "code": "__registerWorklet("main-thread", "d3dd:test:1", function(e) {
          const onScroll = lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          let { label } = this["_c"];
          console.info(label, e);
      });
      ",
            "id": "d3dd:test:1",
            "imports": [
              {
                "imported": "registerWorklet",
                "local": "__registerWorklet",
                "source": "@lynx-js/react/worklet-runtime/init",
              },
            ],
            "runtimeRequirements": {
              "mainThreadProgrammability": true,
            },
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
      "import { registerWorklet as __registerWorklet } from "@lynx-js/react/worklet-runtime/init";
      import { Foo } from './foo.js' with {
          runtime: 'shared'
      };
      __registerWorklet("main-thread", "d3dd:test:1", function() {
          lynxWorkletImpl._workletMap["d3dd:test:1"].bind(this);
          'main thread';
          return new Foo();
      });
      "
    `);
  });

  it('collects shared bindings as module dependencies without capturing them', async () => {
    const result = await transformReactLynx(
      sharedSource,
      options('JS'),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.definesForSnapshot).toEqual([]);
    expect(result.definesForWorklet).toHaveLength(1);
    const [worklet] = result.definesForWorklet;
    expect(worklet.id).toBeTruthy();
    expect(worklet.code).toContain('return new Foo()');
    expect(worklet.code).not.toContain('this["_c"]');
    expect(worklet.unmergeable).toBeUndefined();
    expect(worklet.imports).toContainEqual({
      source: './foo.js',
      imported: 'Foo',
      local: 'Foo',
    });
  });
});
