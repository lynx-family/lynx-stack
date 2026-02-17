// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-check
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../../main.js';

describe.skip('Parse Object Literal Style', () => {
  it('should parse object literal style', async () => {
    const result = await transformReactLynx(
      `<view style={{ width: '100px', 'height': 8000 }}/>`,
    );
    expect(result.code).toContain(`__AddInlineStyle(el, 26, 8000);`);
    expect(result.code).toContain(`__AddInlineStyle(el, 27, '100px');`);
    expect(result.code).not.toContain(`width: '100px'`);
    expect(result.code).not.toContain(`'height': 8000`);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should parse object literal style with different cases', async () => {
    const result = await transformReactLynx(
      `<view style={{ 'flex-direction': 'column', flexShrink: 1 }}/>`,
    );
    expect(result.code).toContain(`__AddInlineStyle(el, 53, 'column')`);
    expect(result.code).toContain(`__AddInlineStyle(el, 51, 1)`);
    expect(result.code).not.toContain(`flexDirection`);
    expect(result.code).not.toContain(`flex-direction`);
    expect(result.code).not.toContain(`flexShrink`);
    expect(result.code).not.toContain(`flex-hrink`);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should parse object literal style with in order', async () => {
    const result = await transformReactLynx(
      `<view style={{ 'flex': 'column', flexShrink: 1, 'flex': 'line' }}/>`,
    );
    expect(result.code).toContain(`__AddInlineStyle(el, 49, 'column')`);
    expect(result.code).toContain(`__AddInlineStyle(el, 51, 1)`);
    expect(result.code).toContain(`__AddInlineStyle(el, 49, 'line')`);
    expect(
      result.code.indexOf(`__AddInlineStyle(el, 49, 'column')`)
        < result.code.indexOf(`__AddInlineStyle(el, 49, 'line')`),
    );
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should parse object literal style with multiple elements', async () => {
    const result = await transformReactLynx(
      `\
<view style={{ 'flex': 'column', flexShrink: 1, 'flex': 'line' }}>
  <view style={{ display: 'flex', flexDirection: 'column' }}>
    <text style={{ color: '#0f0f0f' }}>Hello</text>
  </view>
</view>
`,
    );
    expect(result.code).toContain(`__AddInlineStyle(el, 51, 1)`);
    // Only have one flexShrink: 1
    expect(result.code.split(`__AddInlineStyle(el, 51, 1)`)).toHaveLength(2);
    // Only have one flexDirection: 1
    expect(
      result.code.split(`__AddInlineStyle(el1, 53, 'column')`),
    ).toHaveLength(2);
    // Only have one color: '#0f0f0f'
    expect(
      result.code.split(`__AddInlineStyle(el2, 22, '#0f0f0f')`),
    ).toHaveLength(2);
  });

  // FIXME: should support dedupe
  it.todo('should parse object literal style and dedupe with property ID');

  it('should parse object literal style with exprs as value (static value < dynamic value)', async () => {
    const result = await transformReactLynx(
      `\
let jsx = <view style={{
  width: '200rpx',
  'height': \`100px\`,
  flex: f(),
  display: [],
  overflow: a.b
}}/>`,
      {
        mode: 'test',
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: {
          runtimePkg: '@lynx-js/react-runtime',
          target: 'MIXED',
          filename: '',
        },
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
      },
    );
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          __AddInlineStyle(el, 27, '200rpx');
          __AddInlineStyle(el, 26, \`100px\`);
          return [
              el
          ];
      }, [
          function(ctx) {
              if (ctx.__elements) {
                  let el = ctx.__elements[0];
                  let style_values = ctx.__values[0];
                  __AddInlineStyle(el, 49, style_values[0]), __AddInlineStyle(el, 24, style_values[1]), __AddInlineStyle(el, 25, style_values[2]);
              }
          }
      ], null);
      let jsx = /*#__PURE__*/ _jsx(__snapshot_da39a_test_1, {
          values: [
              [
                  f(),
                  [],
                  a.b
              ]
          ]
      });
      "
    `);
  });

  it('should parse object literal style with exprs as value (dynamic value < static value)', async () => {
    const result = await transformReactLynx(
      `\
const w = globalThis.f();
let jsx = <view style={{
  width: w,
  'height': \`100px\`,
  flex: f(),
  display: [],
  overflow: a.b
}}/>`,
      {
        mode: 'test',
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: {
          runtimePkg: '@lynx-js/react-runtime',
          target: 'MIXED',
          filename: '',
        },
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
      },
    );
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      const w = globalThis.f();
      const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, [
          function(ctx) {
              if (ctx.__elements) {
                  let el = ctx.__elements[0];
                  let style_values = ctx.__values[0];
                  __AddInlineStyle(el, 27, style_values[0]), __AddInlineStyle(el, 26, style_values[1]), __AddInlineStyle(el, 49, style_values[2]), __AddInlineStyle(el, 24, style_values[3]), __AddInlineStyle(el, 25, style_values[4]);
              }
          }
      ], null);
      let jsx = /*#__PURE__*/ _jsx(__snapshot_da39a_test_1, {
          values: [
              [
                  w,
                  \`100px\`,
                  f(),
                  [],
                  a.b
              ]
          ]
      });
      "
    `);
  });

  it('should parse object literal style with identifier as value shorthand', async () => {
    const result = await transformReactLynx(
      `\
let width = f();
let height = '100px';
let jsx = <view style={{ height, width }}/>`,
      {
        mode: 'test',
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: {
          runtimePkg: '@lynx-js/react-runtime',
          target: 'MIXED',
          filename: '',
        },
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
      },
    );
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      let width = f();
      let height = '100px';
      const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, [
          function(ctx) {
              if (ctx.__elements) {
                  let el = ctx.__elements[0];
                  let style_values = ctx.__values[0];
                  __AddInlineStyle(el, 26, style_values[0]), __AddInlineStyle(el, 27, style_values[1]);
              }
          }
      ], null);
      let jsx = /*#__PURE__*/ _jsx(__snapshot_da39a_test_1, {
          values: [
              [
                  height,
                  width
              ]
          ]
      });
      "
    `);
  });

  it('should fallback to SetInlineStyles when have unknown CSS property', async () => {
    const result = await transformReactLynx(
      `<view style={{ width: '100px', invalid: false, height: '200rpx', invalidProperty: 'auto' }}/>`,
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, style)
    expect(result.code).toContain(`width: '100px'`);
    expect(result.code).toContain(`invalid: false`);
    expect(result.code).toContain(`height: '200rpx'`);
    expect(result.warnings).toEqual([]);
  });

  it('should fallback to SetInlineStyles when have computed CSS property', async () => {
    const result = await transformReactLynx(
      `<view style={{ width: value, [key]: false, height: '200rpx' }}/>`,
    );
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, style)
    expect(result.code).toContain(`width: value`);
    expect(result.code).toContain(`[key]: false`);
    expect(result.code).toContain(`height: '200rpx'`);
    expect(result.warnings).toEqual([]);
  });
});
