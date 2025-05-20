// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../../main.js';

describe('simple styling', () => {
  const __cfg = {
    pluginName: 'transform',
    filename: '',
    sourcemap: false,
    cssScope: false,
    jsx: {
      runtimePkg: '@lynx-js/react',
      filename: '',
      target: 'MIXED',
    },
    directiveDCE: false,
    defineDCE: false,
    shake: true,
    compat: {
      target: 'LEPUS',
      componentsPkg: ['@lynx-js/react-components'],
      oldRuntimePkg: ['@lynx-js/react-runtime'],
      newRuntimePkg: '@lynx-js/react',
      additionalComponentAttributes: [],
      addComponentElement: true,
      simplifyCtorLikeReactLynx2: true,
      disableDeprecatedWarning: false,
    },
    worklet: false,
    refresh: false,
    simpleStyling: true,
  };

  it('basic', async () => {
    const input = `
import { SimpleStyleSheet } from '@lynx-js/react'

const styles = SimpleStyleSheet.create({
  static1: {
    width: '100px',
    height: '100px',
  },
  static2: {
    backgroundColor: 'blue',
    color: 'green',
  },
  static3: {
    textAlign: 'center',
    display: 'flex'
  },
  conditional1: {
    borderBottomWidth: '1px',
    borderBottomColor: 'red',
    borderBottomStyle: 'solid',
  },
  conditional2: {
    borderTopWidth: '1px',
    borderTopColor: 'red',
    borderTopStyle: 'solid',
  },
  dynamic: (color, size) => ({
    borderLeftColor: color,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    paddingTop: size,
  })
})

function ComponentWithSimpleStyle({
  condition1,
  condition2,
  dynamicStyleArgs,
}) {
  return (
    <view simpleStyle={[
      styles.static1,
      condition1 && styles.conditional1,
      styles.static2,
      styles.dynamic(...dynamicStyleArgs),
      condition2 && styles.conditional2,
      styles.static3,
    ]}
    />
  )
}

`;

    const { code: mainThreadCode } = await transformReactLynx(
      input,
      __cfg,
    );
    expect(mainThreadCode).toMatchInlineSnapshot(`
      "import * as ReactLynx from "@lynx-js/react";
      /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_be203_1", function(snapshotInstance) {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          __SimpleStyleInject("db4cf10", "width", "100px");
          __SimpleStyleInject("356935a", "height", "100px");
          __SimpleStyleInject("fa2e1f7", "background-color", "blue");
          __SimpleStyleInject("9cdf81d", "color", "green");
          __SimpleStyleInject("75816ca", "display", "flex");
          __SimpleStyleInject("91a8701", "text-align", "center");
          __SimpleStyleInject("f61f6f2", "border-left-style", "solid");
          __SimpleStyleInject("bad68fd", "border-left-width", "1px");
          snapshotInstance.__dy_init = [
              {
                  11: null,
                  21: null,
                  118: null
              },
              {
                  115: null,
                  18: null
              },
              {
                  20: null,
                  10: null,
                  117: null
              }
          ];
          snapshotInstance.__dy_styles = snapshotInstance.__dy_init.map(__CreateStyleObject);
          __SetStyleObject(el, [
              "db4cf10",
              "356935a",
              "fa2e1f7",
              "9cdf81d",
              "75816ca",
              "91a8701",
              "f61f6f2",
              "bad68fd",
              ...snapshotInstance.__dy_styles
          ]);
          return [
              el
          ];
      }, [
          function(ctx) {
              if (ctx.__elements) ReactLynx.updateSimpleStyle(ctx, ctx.__values[0]);
          }
      ], null, undefined, globDynamicComponentEntry);
      "
    `);
  });
  it('dynamic style', async () => {
    const { code } = await transformReactLynx(
      `
import { SimpleStyleSheet } from '@lynx-js/react'

const styles = SimpleStyleSheet.create({
  main: {
    width: '100px',
    height: '100px',
  },
  active: {
    borderBottomWidth: '1px',
  },
  withColor: (color) => ({
    backgroundColor: color,
    width: '10px'
  }),
})
  
export function ReactView({
  color,
  isActive,
}) {
  return (
    <view>
      <view
        simpleStyle={[
          styles.main,
          styles.active
        ]}
      />
      <view
        simpleStyle={[
          styles.main,
          isActive && styles.active,
          styles.withColor(color),
        ]}
      />
    </view>
  )
}
`,
      __cfg,
    );
    expect(code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      const styles = {
          main: {
              27: '100px',
              26: '100px'
          },
          active: {
              21: '1px'
          },
          withColor: (color)=>({
                  7: color
              })
      };
      const __snapshot_da39a_45c7c_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_45c7c_1", function(snapshotInstance) {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          const el1 = __CreateView(pageId);
          __SimpleStyleInject("356935a", "height", "100px");
          __SimpleStyleInject("db4cf10", "width", "100px");
          __SimpleStyleInject("e734863", "border-bottom-width", "1px");
          snapshotInstance.__dy_init = [];
          snapshotInstance.__dy_styles = snapshotInstance.__dy_init.map(__CreateStyleObject);
          __SetStyleObject(el1, [
              "356935a",
              "db4cf10",
              "e734863",
              ...snapshotInstance.__dy_styles
          ]);
          __AppendElement(el, el1);
          const el2 = __CreateView(pageId);
          __SimpleStyleInject("356935a", "height", "100px");
          __SimpleStyleInject("db4cf10", "width", "100px");
          __SimpleStyleInject("5e26c93", "width", "10px");
          snapshotInstance.__dy_init = [
              {
                  21: null
              },
              {
                  27: null
              }
          ];
          snapshotInstance.__dy_styles = snapshotInstance.__dy_init.map(__CreateStyleObject);
          __SetStyleObject(el2, [
              "356935a",
              "db4cf10",
              "5e26c93",
              ...snapshotInstance.__dy_styles
          ]);
          __AppendElement(el, el2);
          return [
              el,
              el1,
              el2
          ];
      }, [
          function(ctx) {
              if (ctx.__elements) ReactLynx.updateSimpleStyle(ctx, ctx.__values[0]);
          }
      ], null, undefined, globDynamicComponentEntry);
      export function ReactView({ color, isActive }) {
          return /*#__PURE__*/ _jsx(__snapshot_da39a_45c7c_1, {
              values: [
                  [
                      isActive && styles.active,
                      styles.withColor(color)
                  ]
              ]
          });
      }
      "
    `);
  });
});
