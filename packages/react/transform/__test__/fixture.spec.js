// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '@lynx-js/react-transform-rspack-napi';

describe('shake', () => {
  it('should match', async () => {
    const inputContent = `
import { Component } from "@lynx-js/react-runtime";
export class A extends Component {
    d = 1
    c = 2
    renderA(){
        this.c = 1;
        this.renderB()
    }
    renderB(){}
    renderC(){}
    render(){
    }
}`;
    const result = await transformReactLynx(inputContent);
    expect(result.code).toMatchInlineSnapshot(`
      "import { Component } from "@lynx-js/react-runtime";
      export class A extends Component {
          d = 1;
          c = 2;
          renderA() {
              this.c = 1;
              this.renderB();
          }
          renderB() {}
          renderC() {}
          render() {}
      }
      "
    `);
  });

  it('should shake with/without jsx transform', async () => {
    const inputContent = `
import { Component } from "@lynx-js/react-runtime";
export class A extends Component {
    d = 1
    c = 2
    renderA(){
        this.c = 1;
        this.renderB()
    }
    renderB(){}
    renderC(){}
    render(){
      return <view/>
    }
}`;

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const __cfg = (snapshot) => ({
      mode: 'test',
      pluginName: '',
      filename: '',
      sourcemap: false,
      cssScope: false,
      snapshot,
      directiveDCE: false,
      defineDCE: false,
      shake: true,
      compat: true,
      worklet: false,
      refresh: false,
    });

    const result = await transformReactLynx(inputContent, __cfg(true));
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      import { Component } from "@lynx-js/react/legacy-react-runtime";
      const __snapshot_da39a_test_1 = "__snapshot_da39a_test_1";
      ReactLynx.snapshotCreatorMap[__snapshot_da39a_test_1] = (__snapshot_da39a_test_1)=>ReactLynx.createSnapshot(__snapshot_da39a_test_1, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateView(pageId);
              return [
                  el
              ];
          }, null, null, undefined, globDynamicComponentEntry, null, true);
      export class A extends Component {
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_test_1, {});
          }
      }
      "
    `);

    const result2 = await transformReactLynx(inputContent, __cfg(false));
    expect(result2.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import { Component } from "@lynx-js/react/legacy-react-runtime";
      export class A extends Component {
          render() {
              return /*#__PURE__*/ _jsx("view", {});
          }
      }
      "
    `);
  });
});

describe('jsx', () => {
  it('should allow JSXNamespace', async () => {
    const result = await transformReactLynx('const jsx = <Foo main-thread:foo={foo} />', {
      pluginName: '',
      filename: '',
      sourceFileName: '',
      defineDCE: true,
      sourcemap: false,
      compat: false,
      snapshot: true,
      shake: true,
      cssScope: false,
      refresh: false,
      directiveDCE: {
        target: 'LEPUS',
      },
      worklet: true,
      experimental_moduleCompress: false,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      /*#__PURE__*/ _jsx(Foo, {
          "main-thread:foo": foo
      });
      ",
        "errors": [],
        "map": undefined,
        "warnings": [],
      }
    `);
  });

  it('<list-item defer item-key="1" />', async () => {
    const result = await transformReactLynx('const jsx = <list><list-item defer item-key="1" /></list>;', {
      pluginName: '',
      filename: '',
      sourceFileName: '',
      defineDCE: true,
      sourcemap: false,
      compat: false,
      snapshot: true,
      shake: true,
      cssScope: false,
      refresh: false,
      directiveDCE: {
        target: 'LEPUS',
      },
      worklet: true,
      experimental_moduleCompress: false,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      import * as ReactLynxRuntimeComponents from '@lynx-js/react/runtime-components';
      const __snapshot_da39a_efa563d7_2 = "__snapshot_da39a_efa563d7_2";
      ReactLynx.snapshotCreatorMap[__snapshot_da39a_efa563d7_2] = (__snapshot_da39a_efa563d7_2)=>ReactLynx.createSnapshot(__snapshot_da39a_efa563d7_2, function() {
              const pageId = ReactLynx.__pageId;
              const el = __CreateElement("list-item", pageId);
              return [
                  el
              ];
          }, [
              (snapshot, index, oldValue)=>ReactLynx.updateListItemPlatformInfo(snapshot, index, oldValue, 0)
          ], ReactLynx.__DynamicPartChildren_0, undefined, globDynamicComponentEntry, null, true);
      const __snapshot_da39a_efa563d7_1 = "__snapshot_da39a_efa563d7_1";
      ReactLynx.snapshotCreatorMap[__snapshot_da39a_efa563d7_1] = (__snapshot_da39a_efa563d7_1)=>ReactLynx.createSnapshot(__snapshot_da39a_efa563d7_1, function(snapshotInstance) {
              const pageId = ReactLynx.__pageId;
              const el = ReactLynx.snapshotCreateList(pageId, snapshotInstance, 0);
              return [
                  el
              ];
          }, null, [
              [
                  ReactLynx.__DynamicPartListChildren,
                  0
              ]
          ], undefined, globDynamicComponentEntry, null, true);
      /*#__PURE__*/ _jsx(__snapshot_da39a_efa563d7_1, {
          children: /*#__PURE__*/ _jsx(ReactLynxRuntimeComponents.DeferredListItem, {
              renderListItem: (__c)=>_jsx(__snapshot_da39a_efa563d7_2, {
                      values: [
                          {
                              "item-key": "1"
                          }
                      ],
                      children: __c
                  }),
              renderChildren: ()=>[],
              defer: true
          })
      });
      ",
        "errors": [],
        "map": undefined,
        "warnings": [],
      }
    `);
  });
});

describe('errors and warnings', () => {
  it('should handle error', async () => {
    const result = await transformReactLynx(`<view>;`);
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "",
        "errors": [
          "Error:   x Expected '</', got '<eof>'
         ,-[test.js:1:1]
       1 | <view>;
         \`----
      ",
        ],
        "warnings": [],
      }
    `);
  });

  it('should nodiff compat', async () => {
    const result = await transformReactLynx(
      `
import { View } from "@lynx-js/react-components";
import { Unused } from "@lynx-js/react-components";
import { Component } from "@lynx-js/react-runtime";
Component, View
`,
      {
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: {
          runtimePkg: '@lynx-js/react-runtime',
          filename: '',
          target: 'MIXED',
        },
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { Component } from "@lynx-js/react/legacy-react-runtime";
      Component, View;
      ",
        "errors": [],
        "map": undefined,
        "warnings": [
          "  ! DEPRECATED: old package "@lynx-js/react-components" is removed
         ,-[:2:1]
       1 | 
       2 | import { View } from "@lynx-js/react-components";
         : ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       3 | import { Unused } from "@lynx-js/react-components";
       4 | import { Component } from "@lynx-js/react-runtime";
       5 | Component, View
         \`----
      ",
          "  ! DEPRECATED: old package "@lynx-js/react-components" is removed
         ,-[:3:1]
       1 | 
       2 | import { View } from "@lynx-js/react-components";
       3 | import { Unused } from "@lynx-js/react-components";
         : ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       4 | import { Component } from "@lynx-js/react-runtime";
       5 | Component, View
         \`----
      ",
          "  ! DEPRECATED: old runtime package "@lynx-js/react-runtime" is changed to "@lynx-js/react"
         ,-[:4:1]
       1 | 
       2 | import { View } from "@lynx-js/react-components";
       3 | import { Unused } from "@lynx-js/react-components";
       4 | import { Component } from "@lynx-js/react-runtime";
         : ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       5 | Component, View
         \`----
      ",
        ],
      }
    `);
  });

  it('should format message', async () => {
    const result = await transformReactLynx(`<view style="invalid: true;"/>;`);
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "invalid: true")
    expect(result.code).toContain('invalid: true');
    expect(result.warnings).toMatchInlineSnapshot(`[]`);
  });

  it('should not warn JSXSpread when not enable addComponentElement', async () => {
    const cfg = {
      pluginName: '',
      filename: '',
      sourcemap: false,
      cssScope: false,
      snapshot: {
        runtimePkg: '@lynx-js/react-runtime',
        filename: '',
        target: 'MIXED',
      },
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: {
        target: 'LEPUS',
        componentsPkg: ['@lynx-js/react-components'],
        oldRuntimePkg: ['@lynx-js/react-runtime'],
        newRuntimePkg: '@lynx-js/react',
        additionalComponentAttributes: [],
        addComponentElement: true,
        simplifyCtorLikeReactLynx2: false,
        disableDeprecatedWarning: false,
      },
      worklet: false,
      refresh: false,
    };

    {
      cfg.compat.addComponentElement = false;
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    }

    {
      cfg.compat.addComponentElement = {
        compilerOnly: true,
      };
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
      expect(result.code).toMatchInlineSnapshot(`
        "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        /*#__PURE__*/ _jsx(Comp, {
            ...s
        });
        "
      `);
    }

    {
      cfg.compat.addComponentElement = true;
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
      expect(result.code).toMatchInlineSnapshot(`
        "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        /*#__PURE__*/ _jsx(Comp, {
            ...s
        });
        "
      `);
    }
  });

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const __cfg = () => ({
    filename: '',
    sourcemap: false,
    cssScope: false,
    snapshot: {
      runtimePkg: '@lynx-js/react-runtime',
      filename: '',
      target: 'MIXED',
    },
    directiveDCE: false,
    defineDCE: false,
    shake: false,
    compat: {
      target: 'LEPUS',
      componentsPkg: ['@lynx-js/react-components'],
      oldRuntimePkg: ['@lynx-js/react-runtime'],
      newRuntimePkg: '@lynx-js/react',
      additionalComponentAttributes: [],
      addComponentElement: true,
      simplifyCtorLikeReactLynx2: false,
      disableDeprecatedWarning: false,
    },
    worklet: false,
    refresh: false,
  });

  it('should error when encounter <component/>', async () => {
    const cfg = __cfg();
    {
      cfg.compat.addComponentElement = true;
      const result = await transformReactLynx(
        `function A() { return <view><component/></view>; }`,
        cfg,
      );
      expect(result.errors).toMatchInlineSnapshot(`[]`);
    }
  });

  it('should error when encounter class property config', async () => {
    const cfg = __cfg();
    {
      const result = await transformReactLynx(
        `class A extends Component { config = {}; render() {return <view/>;} }`,
        cfg,
      );
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          "  ! BROKEN: supporting for class property \`config\` is removed and MUST be migrated in ReactLynx 3.0, you should put your configs inside \`pageConfig\` in lynx.config.js
           ,-[:1:1]
         1 | class A extends Component { config = {}; render() {return <view/>;} }
           :                             ^^^^^^^^^^^^
           \`----
        ",
        ]
      `);
    }
  });

  it('should warning when encounter this.createSelectorQuery', async () => {
    const cfg = __cfg();
    {
      const result = await transformReactLynx(
        `this.createSelectorQuery();
         this.getElementById();`,
        cfg,
      );
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          "  ! BROKEN: createSelectorQuery on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead.
           ,-[:1:1]
         1 | this.createSelectorQuery();
           : ^^^^^^^^^^^^^^^^^^^^^^^^^^
         2 |          this.getElementById();
           \`----
        ",
          "  ! BROKEN: getElementById on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead.
           ,-[:2:1]
         1 | this.createSelectorQuery();
         2 |          this.getElementById();
           :          ^^^^^^^^^^^^^^^^^^^^^
           \`----
        ",
        ]
      `);
    }

    {
      cfg.compat.disableDeprecatedWarning = true;
      const result = await transformReactLynx(
        `this.createSelectorQuery();
         this.getElementById();`,
        cfg,
      );
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          "  ! BROKEN: createSelectorQuery on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead.
           ,-[:1:1]
         1 | this.createSelectorQuery();
           : ^^^^^^^^^^^^^^^^^^^^^^^^^^
         2 |          this.getElementById();
           \`----
        ",
          "  ! BROKEN: getElementById on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead.
           ,-[:2:1]
         1 | this.createSelectorQuery();
         2 |          this.getElementById();
           :          ^^^^^^^^^^^^^^^^^^^^^
           \`----
        ",
        ]
      `);
    }
  });
});

describe('syntaxConfig', () => {
  it('should allow C-style type cast in .ts', async () => {
    const result = await transformReactLynx(`const p = <any>Promise.all([]);`, {
      filename: '',
      sourcemap: false,
      syntaxConfig: {
        syntax: 'typescript',
        tsx: false,
      },
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
    });
    expect(result.code).toMatchInlineSnapshot(`
      "Promise.all([]);
      "
    `);
  });

  it('should throw when using TS feature as TSX', async () => {
    const result = await transformReactLynx(`const p = <any>Promise.all([]);`, {
      filename: '',
      sourcemap: false,
      syntaxConfig: {
        syntax: 'typescript',
        tsx: true,
      },
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
    });

    expect(result.code).toBe('');
    expect(result.errors).toMatchInlineSnapshot(`
      [
        "Error:   x Expected '</', got '<eof>'
         ,-[:1:1]
       1 | const p = <any>Promise.all([]);
         \`----
      ",
      ]
    `);
  });

  it('should allow tsx-style type cast in .tsx', async () => {
    const result = await transformReactLynx(`const foo = <T,>(v: T) => v;foo`, {
      filename: '',
      sourcemap: false,
      syntaxConfig: {
        syntax: 'typescript',
        tsx: true,
      },
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
    });

    // Note that the result is not valid TSX code, but it is valid TS code.
    expect(result.code).toMatchInlineSnapshot(`
      "const foo = (v)=>v;
      foo;
      "
    `);
  });

  it('should compile when using with', async () => {
    const result = await transformReactLynx(`with(x) {y}`, {
      filename: '',
      sourcemap: false,
      syntaxConfig: {
        syntax: 'ecmascript',
        jsx: false,
      },
      isModule: false,
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: {
        filename: 'filename',
        target: 'LEPUS',
        minSdkVersion: '2.14',
        runtimePkg: '@lynx-js/react',
      },
      refresh: false,
    });

    expect(result.errors.length).toBe(0);
  });
});

describe('directive dce', () => {
  it('directive dce warning', async () => {
    const result = await transformReactLynx(
      `
class X {
  constructor() {
    'use js only';
    console.log("js only");
  }
  get xxx() {
    'use js only';
    return 'js only';
  }
  set xxx(v) {
    'use js only';
  }
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: {
          target: 'LEPUS',
        },
        defineDCE: false,
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        "  ! directive inside constructor is not allowed
         ,-[:4:1]
       1 | 
       2 | class X {
       3 |   constructor() {
       4 |     'use js only';
         :     ^^^^^^^^^^^^^^
       5 |     console.log("js only");
       6 |   }
       7 |   get xxx() {
         \`----
      ",
        "  ! directive inside getter/setter is ignored
          ,-[:8:1]
        5 |     console.log("js only");
        6 |   }
        7 |   get xxx() {
        8 |     'use js only';
          :     ^^^^^^^^^^^^^^
        9 |     return 'js only';
       10 |   }
       11 |   set xxx(v) {
          \`----
      ",
        "  ! directive inside getter/setter is ignored
          ,-[:12:1]
        9 |     return 'js only';
       10 |   }
       11 |   set xxx(v) {
       12 |     'use js only';
          :     ^^^^^^^^^^^^^^
       13 |   }
       14 | }
          \`----
      ",
      ]
    `);
  });
});

describe('simplifyCtorLikeReactLynx2', () => {
  it('enable', async () => {
    const result = await transformReactLynx(
      `
let c = 1;
export default class App extends Component {
  a(){}
  constructor(props) {
    super(props);
    if (!__LEPUS__) {
      this.a();
    }
    this.state = {
      a: c,
    }
  }

  render() {
    return <view/>;
  }
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
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
      },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      let c = 1;
      export default class App extends Component {
          a() {}
          constructor(props){
              super(props);
              if (!__LEPUS__) this.a();
              this.state = {
                  a: c
              };
          }
          render() {
              return /*#__PURE__*/ _jsx("view", {});
          }
      }
      "
    `);
  });
});

describe('dynamic import', () => {
  it('lazy import', async () => {
    const result = await transformReactLynx(`await import("https://www/a.js", { with: { type: "component" } });`, {
      filename: '',
      sourcemap: false,
      parserConfig: {
        tsx: true,
      },
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
    });
    expect(result.code).toMatchInlineSnapshot(`
      "import "@lynx-js/react/experimental/lazy/import";
      import { __dynamicImport } from "@lynx-js/react/internal";
      await __dynamicImport("https://www/a.js", {
          with: {
              type: "component"
          }
      });
      "
    `);
  });
  it('inline import', async () => {
    const result = await transformReactLynx(`await import(/*webpackChunkName: "./index.js-test"*/"./index.js");`, {
      filename: '',
      sourcemap: false,
      parserConfig: {
        tsx: true,
      },
      cssScope: false,
      snapshot: false,
      directiveDCE: false,
      defineDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
    });
    expect(result.code).toMatchInlineSnapshot(`
      "import 'data:text/javascript;charset=utf-8,import { loadLazyBundle } from "@lynx-js/react/internal";lynx.loadLazyBundle = loadLazyBundle;';
      await import(/*webpackChunkName: "./index.js-test"*/ /*webpackChunkName: "./index.js-"*/ "./index.js");
      "
    `);
  });
  it('badcase', async () => {
    const result = await transformReactLynx(
      `\
(async function () {
  await import(0);
  await import(0, 0);
  await import("./index.js", { with: { typo: "component" } });
  await import("https://www/a.js", { with: { typo: "component" } });
  await import(url, { with: { typo: "component" } });
})();
`,
      {
        pluginName: '',
        filename: '',
        sourcemap: false,
        parserConfig: {
          tsx: true,
        },
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
      },
    );

    expect(result.code).toMatchInlineSnapshot(`""`);
    expect(result.errors).toMatchInlineSnapshot(`
      [
        "Error:   x \`import(...)\` call with non-string literal module id is not allowed
         ,-[:2:1]
       1 | (async function () {
       2 |   await import(0);
         :         ^^^^^^^^^
       3 |   await import(0, 0);
       4 |   await import("./index.js", { with: { typo: "component" } });
       5 |   await import("https://www/a.js", { with: { typo: "component" } });
         \`----
        x \`import(...)\` call with non-string literal module id is not allowed
         ,-[:3:1]
       1 | (async function () {
       2 |   await import(0);
       3 |   await import(0, 0);
         :         ^^^^^^^^^^^^
       4 |   await import("./index.js", { with: { typo: "component" } });
       5 |   await import("https://www/a.js", { with: { typo: "component" } });
       6 |   await import(url, { with: { typo: "component" } });
         \`----
        x \`import("...", ...)\` with invalid options is not allowed
         ,-[:4:1]
       1 | (async function () {
       2 |   await import(0);
       3 |   await import(0, 0);
       4 |   await import("./index.js", { with: { typo: "component" } });
         :         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       5 |   await import("https://www/a.js", { with: { typo: "component" } });
       6 |   await import(url, { with: { typo: "component" } });
       7 | })();
         \`----
      ",
      ]
    `);
  });
});

describe('define dce', () => {
  it('define dce should work - basic', async () => {
    const result = await transformReactLynx(
      `
function X() {
  if (__LEPUS__) {
    return;
  }
  console.log("xxx");
}

X();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X() {
          return;
      }
      X();
      "
    `);
  });

  it('define dce should work - with && ||', async () => {
    const result = await transformReactLynx(
      `
function X1() {
  if (__LEPUS__ && __JS__) {
    return;
  }
  console.log("xxx");
}
function X2() {
  if (__LEPUS__ || __JS__) {
    return;
  }
  console.log("xxx");
}
function X3() {
  if (__LEPUS__ && 0) {
    return;
  }
  console.log("xxx");
}
function X4() {
  if (__LEPUS__ && 1) {
    return;
  }
  console.log("xxx");
}
function X5() {
  if (__LEPUS__ || 1) {
    return;
  }
  console.log("xxx");
}


X1();
X2();
X3();
X4();
X5();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X1() {
          console.log("xxx");
      }
      function X2() {
          return;
      }
      function X3() {
          console.log("xxx");
      }
      function X4() {
          return;
      }
      function X5() {
          return;
      }
      X1();
      X2();
      X3();
      X4();
      X5();
      "
    `);
  });

  it('define dce should work - with import', async () => {
    const result = await transformReactLynx(
      `
import { x } from "./a"
function X() {
  if (__LEPUS__ || 0) {
    return;
  }
  x();
}

X();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X() {
          return;
      }
      X();
      "
    `);
  });

  it('define dce should work - with typeof', async () => {
    const result = await transformReactLynx(
      `
function X() {
  console.log(typeof __LEPUS__)
  console.log(typeof __NON_EXISTS__)
  if (typeof __LEPUS__ === "boolean") {
    console.log("xxx")
  } else {
    console.log("yyy")
  }
}

X();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X() {
          console.log("boolean");
          console.log(typeof __NON_EXISTS__);
          console.log("xxx");
      }
      X();
      "
    `);
  });

  it('define dce should work - should recursive', async () => {
    const result = await transformReactLynx(
      `
function X() {
  console.log(typeof __LEPUS__)
  console.log(typeof __NON_EXISTS__)
  console.log(typeof __NON_EXISTS_2__)
}

X();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __NON_EXISTS__: '__LEPUS__',
            __NON_EXISTS_2__: '__NON_EXISTS__',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X() {
          console.log("boolean");
          console.log("boolean");
          console.log("boolean");
      }
      X();
      "
    `);
  });

  it('define dce should work - shorthand object property', async () => {
    const result = await transformReactLynx(
      `
function X() {
  return {
    __LEPUS__
  }
}

X();
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
          },
        },
        shake: false,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "function X() {
          return {
              __LEPUS__: true
          };
      }
      X();
      "
    `);
  });

  it('define dce should work - with shake', async () => {
    const result = await transformReactLynx(
      `
class X extends Component {
  constructor() {
    if (__JS__) {
      this.init();
    }
  }
  componentDidMount() {
    this.init();
  }
  init() {
    console.log("should be shake")
  }
  render() {
    return <view/>
  }
}
<X/>;
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: true,
        compat: true,
        worklet: false,
        refresh: false,
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      class X extends Component {
          constructor(){}
          render() {
              return /*#__PURE__*/ _jsx("view", {});
          }
      }
      /*#__PURE__*/ _jsx(X, {});
      "
    `);
  });
});

describe('worklet', () => {
  it('should error on unsupported runtime import attribute', async () => {
    const result = await transformReactLynx(
      `\
import { foo } from "./shared.js" with { runtime: "invalid" };
export function bar() {
  "main thread";
  foo();
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      import { foo } from "./shared.js";
      export let bar = {
          _c: {
              foo
          },
          _wkltId: "da39:c870c599:1"
      };
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:c870c599:1", function() {
          const bar = lynxWorkletImpl._workletMap["da39:c870c599:1"].bind(this);
          let { foo } = this["_c"];
          "main thread";
          foo();
      });
      ",
        "errors": [],
        "map": undefined,
        "warnings": [],
      }
    `);
  });

  it('should error on non-string runtime import attribute', async () => {
    const result = await transformReactLynx(
      `\
import { foo } from "./shared.js" with { runtime: 123 };
export function bar() {
  "main thread";
  foo();
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        refresh: false,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors).toMatchInlineSnapshot(
      'Invalid runtime value. Only \'shared\' is supported.',
    );
  });

  it('should error on non-string \'runtime\' key runtime import attribute', async () => {
    const result = await transformReactLynx(
      `\
import { foo } from "./shared.js" with { runtime: "shared" };
export function bar() {
  "main thread";
  foo();
}
`,
      {
        filename: '',
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "code": "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      import { foo } from "./shared.js";
      export let bar = {
          _c: {
              foo
          },
          _wkltId: "da39:9499413b:1"
      };
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:9499413b:1", function() {
          const bar = lynxWorkletImpl._workletMap["da39:9499413b:1"].bind(this);
          let { foo } = this["_c"];
          "main thread";
          foo();
      });
      ",
        "errors": [],
        "map": undefined,
        "warnings": [],
      }
    `);
  });

  for (const target of ['LEPUS', 'JS', 'MIXED']) {
    it('member expression', async () => {
      const { code } = await transformReactLynx(
        `\
  export function getCurrentDelta(event) {
    "main thread";
    return foo.bar.baz;
  }
  `,
        {
          filename: '',
          sourcemap: false,
          cssScope: false,
          snapshot: false,
          directiveDCE: true,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
          shake: false,
          compat: true,
          refresh: false,
          worklet: {
            target,
            filename: '',
            runtimePkg: '@lynx-js/react',
          },
        },
      );

      if (target === 'LEPUS') {
        expect(code).toMatchInlineSnapshot(`
          "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
          var loadWorkletRuntime = __loadWorkletRuntime;
          export let getCurrentDelta = {
              _c: {
                  foo: {
                      bar: {
                          baz: foo.bar.baz
                      }
                  }
              },
              _wkltId: "da39:b88d3c29:1"
          };
          const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
          __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:b88d3c29:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:b88d3c29:1"].bind(this);
              let { foo } = this["_c"];
              "main thread";
              return foo.bar.baz;
          });
          "
        `);
      } else if (target === 'JS') {
        expect(code).toMatchInlineSnapshot(`
          "export let getCurrentDelta = {
              _c: {
                  foo: {
                      bar: {
                          baz: foo.bar.baz
                      }
                  }
              },
              _wkltId: "da39:b88d3c29:1"
          };
          "
        `);
      } else if (target === 'MIXED') {
        expect(code).toMatchInlineSnapshot(`
          "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
          var loadWorkletRuntime = __loadWorkletRuntime;
          export let getCurrentDelta = {
              _c: {
                  foo: {
                      bar: {
                          baz: foo.bar.baz
                      }
                  }
              },
              _wkltId: "da39:b88d3c29:1"
          };
          const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
          __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:b88d3c29:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:b88d3c29:1"].bind(this);
              let { foo } = this["_c"];
              "main thread";
              return foo.bar.baz;
          });
          "
        `);
      }
    });
  }

  it('member expression with multiple times', async () => {
    const { code } = await transformReactLynx(
      `\
export function foo(event) {
  "main thread";
  return bar.baz['qux'] || bar.qux['baz'] || qux.bar.baz;
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        refresh: false,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      export let foo = {
          _c: {
              bar: {
                  baz: {
                      'qux': bar.baz['qux']
                  },
                  qux: {
                      'baz': bar.qux['baz']
                  }
              },
              qux: {
                  bar: {
                      baz: qux.bar.baz
                  }
              }
          },
          _wkltId: "da39:21759364:1"
      };
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:21759364:1", function(event) {
          const foo = lynxWorkletImpl._workletMap["da39:21759364:1"].bind(this);
          let { bar, qux } = this["_c"];
          "main thread";
          return bar.baz['qux'] || bar.qux['baz'] || qux.bar.baz;
      });
      "
    `);
  });

  it('nested', async () => {
    const { code } = await transformReactLynx(
      `\
function foo() {
  "main thread";
  return null;
}
function bar() {
  "main thread";
  foo()
}
console.log(bar)
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        refresh: false,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      let foo = {
          _wkltId: "da39:2ec866b7:1"
      };
      let bar = {
          _c: {
              foo
          },
          _wkltId: "da39:2ec866b7:2"
      };
      console.log(bar);
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:2ec866b7:1", function() {
          const foo = lynxWorkletImpl._workletMap["da39:2ec866b7:1"].bind(this);
          "main thread";
          return null;
      });
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:2ec866b7:2", function() {
          const bar = lynxWorkletImpl._workletMap["da39:2ec866b7:2"].bind(this);
          let { foo } = this["_c"];
          "main thread";
          foo();
      });
      "
    `);
  });

  it('use multiple times', async () => {
    const { code } = await transformReactLynx(
      `\
function getCurrentDelta(event) {
  "main thread";
  if (foo(a)) {
    if (foo(b)) {}
  }
  return null;
}
`,
      {
        filename: '',
        sourcemap: false,
        cssScope: false,
        snapshot: false,
        directiveDCE: true,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
        shake: false,
        compat: true,
        refresh: false,
        worklet: {
          target: 'LEPUS',
          filename: '',
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      const __workletRuntimeLoaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry);
      __workletRuntimeLoaded && registerWorkletInternal("main-thread", "da39:b69521f0:1", function(event) {
          lynxWorkletImpl._workletMap["da39:b69521f0:1"].bind(this);
          let { foo, a, b } = this["_c"];
          "main thread";
          if (foo(a)) foo(b);
          return null;
      });
      "
    `);
  });

  it('should keep webpack runtime variables', async () => {
    const inputContent = `
__webpack_public_path__="a";
__webpack_require__.p="b";
__webpack_test__="a";
import { Component } from "@lynx-js/react-runtime";
export class A extends Component {}
`;
    const { code } = await transformReactLynx(inputContent);
    expect(code).toMatchInlineSnapshot(`
      "__webpack_public_path__ = "a";
      __webpack_require__.p = "b";
      __webpack_test__ = "a";
      import { Component } from "@lynx-js/react-runtime";
      export class A extends Component {
      }
      "
    `);
  });
});
