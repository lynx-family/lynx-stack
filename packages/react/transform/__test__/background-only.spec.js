// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

function options(target) {
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
  };
}

const source = `
import { Feed } from "./Feed.jsx";

export function App() {
  return (
    <view>
      <background-only fallback={<text>loading</text>}>
        <Feed />
      </background-only>
    </view>
  );
}
`;

describe('background-only element', () => {
  it('keeps the fallback on the main thread', async () => {
    const result = await transformReactLynx(source, options('LEPUS'));

    expect(result.errors).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/lepus/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react/internal";
      const __snapshot_a94a8_test_2 = "__snapshot_a94a8_test_2";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_2] = (__snapshot_a94a8_test_2)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_2, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateText(pageId);
              const el1 = __CreateRawText("loading");
              __AppendElement(el, el1);
              return [
                  el,
                  el1
              ];
          }, null, null, undefined, globDynamicComponentEntry, null, true);
      const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              return [
                  el
              ];
          }, null, ReactLynx.__DynamicPartSlotV2_0, undefined, globDynamicComponentEntry, null, true);
      export function App() {
          return /*#__PURE__*/ _jsx(__snapshot_a94a8_test_1, {
              $0: /*#__PURE__*/ _jsx(__snapshot_a94a8_test_2, {})
          });
      }
      "
    `);
  });

  it('keeps the children on the background thread', async () => {
    const result = await transformReactLynx(source, options('JS'));

    expect(result.errors).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react/internal";
      import { Feed } from "./Feed.jsx";
      const __snapshot_a94a8_test_2 = "__snapshot_a94a8_test_2";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_2] = (__snapshot_a94a8_test_2)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_2, null, null, null, undefined, globDynamicComponentEntry, null, true);
      const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, null, null, ReactLynx.__DynamicPartSlotV2_0, undefined, globDynamicComponentEntry, null, true);
      export function App() {
          return /*#__PURE__*/ _jsx(__snapshot_a94a8_test_1, {
              $0: /*#__PURE__*/ _jsx(Feed, {})
          });
      }
      "
    `);
  });

  it('renders nothing on the main thread without a fallback', async () => {
    const result = await transformReactLynx(
      `
      export function App() {
        return (
          <view>
            <background-only>
              <text>background</text>
            </background-only>
          </view>
        );
      }
      `,
      options('LEPUS'),
    );

    expect(result.errors).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/lepus/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react/internal";
      const __snapshot_a94a8_test_2 = "__snapshot_a94a8_test_2";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_2] = (__snapshot_a94a8_test_2)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_2, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateText(pageId);
              const el1 = __CreateRawText("background");
              __AppendElement(el, el1);
              return [
                  el,
                  el1
              ];
          }, null, null, undefined, globDynamicComponentEntry, null, true);
      const __snapshot_a94a8_test_1 = "__snapshot_a94a8_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_a94a8_test_1] = (__snapshot_a94a8_test_1)=>ReactLynx.createSnapshot(__snapshot_a94a8_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              return [
                  el
              ];
          }, null, ReactLynx.__DynamicPartSlotV2_0, undefined, globDynamicComponentEntry, null, true);
      export function App() {
          return /*#__PURE__*/ _jsx(__snapshot_a94a8_test_1, {
              $0: null
          });
      }
      "
    `);
  });

  it('reports an error for spread attributes', async () => {
    const result = await transformReactLynx(
      `
      export function App(props) {
        return <background-only {...props} />;
      }
      `,
      options('LEPUS'),
    );

    expect(result.errors.map((error) => error.text)).toMatchInlineSnapshot(`
      [
        "spread attributes on <background-only> are not supported",
      ]
    `);
  });

  it('reports an error for a repeated fallback', async () => {
    const result = await transformReactLynx(
      `
      export function App() {
        return (
          <background-only
            fallback={<text attr-x='first' />}
            fallback={<text attr-x='second' />}
          >
            <Feed />
          </background-only>
        );
      }
      `,
      options('LEPUS'),
    );

    expect(result.errors.map((error) => error.text)).toMatchInlineSnapshot(`
      [
        "<background-only> accepts only one \`fallback\` attribute",
      ]
    `);
    expect(result.code).toContain('first');
    expect(result.code).not.toContain('second');
  });

  it('reports an error for unknown attributes', async () => {
    const result = await transformReactLynx(
      `
      export function App() {
        return <background-only placeholder={<view />} />;
      }
      `,
      options('JS'),
    );

    expect(result.errors.map((error) => error.text)).toMatchInlineSnapshot(`
      [
        "<background-only> only supports the \`fallback\` attribute",
      ]
    `);
  });
  it('rejects the element under element templates', async () => {
    const result = await transformReactLynx(
      `
      export function App() {
        return (
          <view>
            <background-only fallback={<text>loading</text>}>
              <text>content</text>
            </background-only>
          </view>
        );
      }
      `,
      {
        ...options('LEPUS'),
        snapshot: false,
        elementTemplate: {
          preserveJsx: false,
          runtimePkg: '@lynx-js/react/element-template',
          jsxImportSource: '@lynx-js/react/element-template',
          filename: 'test',
          target: 'LEPUS',
          isDynamicComponent: false,
          isExternalBundle: false,
        },
      },
    );

    expect(result.errors.map((error) => error.text)).toMatchInlineSnapshot(`
      [
        "<background-only> is not supported with \`experimental_useElementTemplate\`: the element templates of the deferred subtree are not registered for the main thread, so it cannot hydrate.",
      ]
    `);
  });
});
