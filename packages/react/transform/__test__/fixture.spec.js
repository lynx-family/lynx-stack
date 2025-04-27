// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// cSpell:disable
import { formatMessages } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { transformBundleResult, transformReactLynx } from '../main.js';

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
    const __cfg = (jsx) => ({
      mode: 'test',
      pluginName: '',
      filename: '',
      sourcemap: false,
      cssScope: false,
      jsx,
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
      const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
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
      import * as ReactLynx from "@lynx-js/react";
      import { Component } from "@lynx-js/react/legacy-react-runtime";
      const __snapshot_da39a_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
      export class A extends Component {
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_test_1, {});
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
      jsx: true,
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
          {
            "location": {
              "column": 1,
              "file": "",
              "length": 4,
              "line": 1,
              "lineText": "<view>;",
            },
            "pluginName": "",
            "text": "Unexpected token \`view\`. Expected jsx identifier",
          },
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
        jsx: {
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
        "warnings": [
          {
            "location": {
              "column": 0,
              "file": "",
              "length": 49,
              "line": 2,
              "lineText": "import { View } from "@lynx-js/react-components";",
            },
            "pluginName": "",
            "text": "DEPRECATED: old package "@lynx-js/react-components" is removed",
          },
          {
            "location": {
              "column": 0,
              "file": "",
              "length": 51,
              "line": 4,
              "lineText": "import { Component } from "@lynx-js/react-runtime";",
            },
            "pluginName": "",
            "text": "DEPRECATED: old runtime package "@lynx-js/react-runtime" is changed to "@lynx-js/react"",
          },
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
    expect(
      await formatMessages(result.warnings, { kind: 'warning', color: false }),
    ).toMatchInlineSnapshot(`[]`);
  });

  it('should not warn JSXSpread when not enable addComponentElement', async () => {
    const { formatMessages } = await import('esbuild');

    const cfg = {
      pluginName: '',
      filename: '',
      sourcemap: false,
      cssScope: false,
      jsx: {
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
      expect(
        await formatMessages(result.warnings, {
          kind: 'warning',
          color: false,
        }),
      ).toMatchInlineSnapshot(`[]`);
    }

    {
      cfg.compat.addComponentElement = {
        compilerOnly: true,
      };
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(
        await formatMessages(result.warnings, {
          kind: 'warning',
          color: false,
        }),
      ).toMatchInlineSnapshot(`
        [
          "▲ [WARNING] addComponentElement: component with JSXSpread is ignored to avoid badcase, you can switch addComponentElement.compilerOnly to false to enable JSXSpread support

            :1:7:
              1 │ <Comp {...s}/>;
                ╵        ~~~

        ",
        ]
      `);
      expect(result.code).toMatchInlineSnapshot(`
        "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        _jsx(Comp, {
            ...s
        });
        "
      `);
    }

    {
      cfg.compat.addComponentElement = true;
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(
        await formatMessages(result.warnings, {
          kind: 'warning',
          color: false,
        }),
      ).toMatchInlineSnapshot(`[]`);
      expect(result.code).toMatchInlineSnapshot(`
        "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        import * as ReactLynx from "@lynx-js/react";
        import * as ReactLynx1 from "@lynx-js/react/internal";
        const __snapshot_da39a_89b7f_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_89b7f_1", function() {
            const pageId = ReactLynx.__pageId;
            const el = __CreateView(pageId);
            return [
                el
            ];
        }, [
            (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 0)
        ], ReactLynx.__DynamicPartChildren_0, undefined, globDynamicComponentEntry);
        /*#__PURE__*/ ReactLynx1.wrapWithLynxComponent((__c, __spread)=>/*#__PURE__*/ _jsx(__snapshot_da39a_89b7f_1, {
                values: [
                    {
                        ...__spread,
                        __spread: true
                    }
                ],
                children: __c
            }), _jsx(Comp, {
            ...s
        }));
        "
      `);
    }
  });

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const __cfg = () => ({
    pluginName: 'transform',
    filename: '',
    sourcemap: false,
    cssScope: false,
    jsx: {
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
    const { formatMessages } = await import('esbuild');

    const cfg = __cfg();
    {
      cfg.compat.addComponentElement = true;
      const result = await transformReactLynx(
        `function A() { return <view><component/></view>; }`,
        cfg,
      );
      expect(
        await formatMessages(result.errors, { kind: 'error', color: false }),
      ).toMatchInlineSnapshot(`[]`);
    }
  });

  it('should error when encounter class property config', async () => {
    const { formatMessages } = await import('esbuild');

    const cfg = __cfg();
    {
      const result = await transformReactLynx(
        `class A extends Component { config = {}; render() {return <view/>;} }`,
        cfg,
      );
      expect(
        await formatMessages(result.warnings, {
          kind: 'warning',
          color: false,
        }),
      ).toMatchInlineSnapshot(`
        [
          "▲ [WARNING] BROKEN: supporting for class property \`config\` is removed and MUST be migrated in ReactLynx 3.0, you should put your configs inside \`pageConfig\` in lynx.config.js [plugin transform]

            :1:28:
              1 │ class A extends Component { config = {}; render() {return <view/>;} }
                ╵                             ~~~~~~~~~~~~

        ",
        ]
      `);
    }
  });

  it('should warning when encounter this.createSelectorQuery', async () => {
    const { formatMessages } = await import('esbuild');

    const cfg = __cfg();
    {
      const result = await transformReactLynx(
        `this.createSelectorQuery();
         this.getElementById();`,
        cfg,
      );
      expect(
        await formatMessages(result.warnings, {
          kind: 'warning',
          color: false,
        }),
      ).toMatchInlineSnapshot(`
        [
          "▲ [WARNING] BROKEN: createSelectorQuery on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead. [plugin transform]

            :1:0:
              1 │ this.createSelectorQuery();
                ╵ ~~~~~~~~~~~~~~~~~~~~~~~~~~

        ",
          "▲ [WARNING] BROKEN: getElementById on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead. [plugin transform]

            :2:9:
              2 │          this.getElementById();
                ╵          ~~~~~~~~~~~~~~~~~~~~~

        ",
        ]
      `);
    }
  });
});

describe('transformBundle', () => {
  it('should extract lepus str', async () => {
    const inputContent = `
    gloablThis.processData = ()=>{
      if (true) {
        return {
          _EXTRACT_STR: __EXTRACT_STR_IDENT_FLAG__,
        };
      }
    }
    const qq = {
      a: '123',
      b: false ? '456' : '789'
    };
    console.log('!@#@#$!!@#!#!3sasdega!!23!#$!@#%%');
    let q = fun('456');
    let a = '789';
    const b = '111' + '000';`;
    const result = await transformBundleResult(inputContent, {
      filename: 'lepus.js',
      pluginName: 'transformBundleResult',
      sourcemap: true,
      extractStr: {
        strLength: 1,
      },
    });
    expect(result.code).toMatchInlineSnapshot(`
      "var _EXTRACT_STR = [
          "123",
          "456",
          "789",
          "!@#@#$!!@#!#!3sasdega!!23!#$!@#%%",
          "111",
          "000"
      ];
      gloablThis.processData = ()=>{
          if (true) {
              return {
                  _EXTRACT_STR: _EXTRACT_STR
              };
          }
      };
      const qq = {
          a: _EXTRACT_STR[0],
          b: false ? _EXTRACT_STR[1] : _EXTRACT_STR[2]
      };
      console.log(_EXTRACT_STR[3]);
      let q = fun(_EXTRACT_STR[1]);
      let a = _EXTRACT_STR[2];
      const b = _EXTRACT_STR[4] + _EXTRACT_STR[5];
      "
    `);
  });
  it('should apply js str', async () => {
    const inputContent = `
    function aaa() {
      var tt = lynxCoreInject.tt;
      // for __EXTRACT_STR_FLAG__
      tt.__sourcemap__release__ = "123";
      tt.define("app-service.js", function(){
        __EXTRACT_STR_JS_FLAG__(z=lynxCoreInject.tt._params.updateData._EXTRACT_STR,z);
        const qq = {
          a: '123',
          b: false ? '456' : '789'
        };
        function render(){
          const { abc: z } = this.state
          console.log(z);
          console.log('456');
        }
        function ffff(z) {
          console.log(z);
          return "asdasdasd"
        }
        console.log('!@#@#$!!@#!#!3sasdega!!23!#$!@#%%');
        let q = fun('456');
        let a = '789';
        const b = '111' + '000';
      });
  }`;
    const result = await transformBundleResult(inputContent, {
      filename: 'app-service.js',
      pluginName: 'transformBundleResult',
      sourcemap: true,
      extractStr: {
        strLength: 1,
        extractedStrArr: ['123', '456', 'asdasdasd'],
      },
    });
    expect(result.code).toMatchInlineSnapshot(`
      "function aaa() {
          var tt = lynxCoreInject.tt;
          // for __EXTRACT_STR_FLAG__
          tt.__sourcemap__release__ = "123";
          tt.define("app-service.js", function() {
              __EXTRACT_STR_JS_FLAG__(z = lynxCoreInject.tt._params.updateData._EXTRACT_STR, z);
              const qq = {
                  a: '123',
                  b: false ? '456' : '789'
              };
              function render() {
                  const { abc: z1 } = this.state;
                  console.log(z1);
                  console.log('456');
              }
              function ffff(z1) {
                  console.log(z1);
                  return "asdasdasd";
              }
              console.log('!@#@#$!!@#!#!3sasdega!!23!#$!@#%%');
              let q = fun('456');
              let a = '789';
              const b = '111' + '000';
          });
      }
      "
    `);
  });

  it('should allow C-style type cast in .ts', async () => {
    const result = await transformReactLynx(`const p = <any>Promise.all([]);`, {
      pluginName: '',
      filename: '',
      sourcemap: false,
      syntaxConfig: JSON.stringify({
        syntax: 'typescript',
        tsx: false,
      }),
      cssScope: false,
      jsx: false,
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
      pluginName: '',
      filename: '',
      sourcemap: false,
      syntaxConfig: JSON.stringify({
        syntax: 'typescript',
        tsx: true,
      }),
      cssScope: false,
      jsx: false,
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
        {
          "location": {
            "column": 11,
            "file": "",
            "length": 3,
            "line": 1,
            "lineText": "const p = <any>Promise.all([]);",
          },
          "pluginName": "",
          "text": "Unexpected token \`any\`. Expected jsx identifier",
        },
      ]
    `);
  });

  it('should allow tsx-style type cast in .tsx', async () => {
    const result = await transformReactLynx(`const foo = <T,>(v: T) => v;foo`, {
      pluginName: '',
      filename: '',
      sourcemap: false,
      syntaxConfig: JSON.stringify({
        syntax: 'typescript',
        tsx: true,
      }),
      cssScope: false,
      jsx: false,
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
      pluginName: '',
      filename: '',
      sourcemap: false,
      syntaxConfig: JSON.stringify({
        syntax: 'ecmascript',
        jsx: false,
      }),
      isModule: false,
      cssScope: false,
      jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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

    expect(
      await formatMessages(result.warnings, { kind: 'warning', color: false }),
    ).toMatchInlineSnapshot(`
      [
        "▲ [WARNING] directive inside constructor is not allowed

          :4:4:
            4 │     'use js only';
              ╵     ~~~~~~~~~~~~~~

      ",
        "▲ [WARNING] directive inside getter/setter is ignored

          :8:4:
            8 │     'use js only';
              ╵     ~~~~~~~~~~~~~~

      ",
        "▲ [WARNING] directive inside getter/setter is ignored

          :12:4:
            12 │     'use js only';
               ╵     ~~~~~~~~~~~~~~

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
        pluginName: 'transform',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
      import * as ReactLynx from "@lynx-js/react";
      let c = 1;
      const __snapshot_da39a_b7447_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_b7447_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
      export default class App extends Component {
          a() {}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_b7447_1, {});
          }
          state = ((()=>{
              if (!__LEPUS__) this.a();
          })(), {
              a: c
          });
      }
      "
    `);
  });
});

describe('dynamic import', () => {
  it('badcase', async () => {
    const result = await transformReactLynx(
      `\
(async function () {
  await import();
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
        jsx: false,
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: false,
        worklet: false,
        refresh: false,
      },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "import { __dynamicImport } from "@lynx-js/react/internal";
      (async function() {
          await import();
          await import(0);
          await import(0, 0);
          await import("./index.js", {
              with: {
                  typo: "component"
              }
          });
          await __dynamicImport("https://www/a.js", {
              with: {
                  typo: "component"
              }
          });
          await __dynamicImport(url, {
              with: {
                  typo: "component"
              }
          });
      })();
      "
    `);
    expect(await formatMessages(result.errors, { kind: 'error', color: false }))
      .toMatchInlineSnapshot(`
        [
          "✘ [ERROR] \`import()\` with no argument is not allowed

            :2:8:
              2 │   await import();
                ╵         ~~~~~~~~

        ",
          "✘ [ERROR] \`import(...)\` call with non-string literal module id is not allowed

            :3:8:
              3 │   await import(0);
                ╵         ~~~~~~~~~

        ",
          "✘ [ERROR] \`import(...)\` call with non-string literal module id is not allowed

            :4:8:
              4 │   await import(0, 0);
                ╵         ~~~~~~~~~~~~

        ",
          "✘ [ERROR] \`import("...", ...)\` with invalid options is not allowed

            :5:8:
              5 │   await import("./index.js", { with: { typo: "component" } });
                ╵         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
      import * as ReactLynx from "@lynx-js/react";
      const __snapshot_da39a_e2935_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_e2935_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
      class X extends Component {
          constructor(){}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_e2935_1, {});
          }
      }
      /*#__PURE__*/ _jsx(X, {});
      "
    `);
  });
});

describe('worklet', () => {
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
          pluginName: '',
          filename: '',
          sourcemap: false,
          cssScope: false,
          jsx: false,
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
              _lepusWorkletHash: "da39:75a1b:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:75a1b:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:75a1b:1"].bind(this);
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
              _wkltId: "da39:75a1b:1"
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
              _wkltId: "da39:75a1b:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:75a1b:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:75a1b:1"].bind(this);
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
          _lepusWorkletHash: "da39:64631:1"
      };
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:64631:1", function(event) {
          const foo = lynxWorkletImpl._workletMap["da39:64631:1"].bind(this);
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
          _lepusWorkletHash: "da39:80ef4:1"
      };
      let bar = {
          _c: {
              foo
          },
          _lepusWorkletHash: "da39:80ef4:2"
      };
      console.log(bar);
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:80ef4:1", function() {
          const foo = lynxWorkletImpl._workletMap["da39:80ef4:1"].bind(this);
          "main thread";
          return null;
      });
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:80ef4:2", function() {
          const bar = lynxWorkletImpl._workletMap["da39:80ef4:2"].bind(this);
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
        pluginName: '',
        filename: '',
        sourcemap: false,
        cssScope: false,
        jsx: false,
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
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:059d0:1", function(event) {
          lynxWorkletImpl._workletMap["da39:059d0:1"].bind(this);
          let { foo, a, b } = this["_c"];
          "main thread";
          if (foo(a)) foo(b);
          return null;
      });
      "
    `);
  });
});
