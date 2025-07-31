// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { transformReactLynx } from '../main.js';

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
      sourcemap: false,
      cssScope: false,
      jsx,
      directiveDCE: false,
      defineDCE: false,
      shake: true,
      compat: true,
      worklet: false,
    });

    const result = await transformReactLynx(inputContent, __cfg(true));
    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      import { Component } from "@lynx-js/react/legacy-react-runtime";
      const __snapshot_05fe4_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_05fe4_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry, null);
      export class A extends Component {
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_05fe4_test_1, {});
          }
      }
      "
    `);

    const result2 = await transformReactLynx(inputContent, __cfg(false));
    expect(result2.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      import { Component } from "@lynx-js/react/legacy-react-runtime";
      const __snapshot_05fe4_test_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_05fe4_test_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry, null);
      export class A extends Component {
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_05fe4_test_1, {});
          }
      }
      "
    `);
  });
});

describe('jsx', () => {
  it('should allow JSXNamespace', async () => {
    const result = await transformReactLynx('const jsx = <Foo main-thread:foo={foo} />', {
      defineDCE: true,
      sourcemap: false,
      compat: false,
      snapshot: true,
      shake: true,
      cssScope: false,
      directiveDCE: {
        target: 'LEPUS',
      },
      worklet: true,
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
});

describe('errors and warnings', () => {
  it('should handle error', async () => {
    const result = await transformReactLynx(`<view>;`);
    expect(result).toMatchInlineSnapshot(`
      {
        "code": "",
        "errors": [
          [Error:   x Unexpected eof
         ,----
       1 | <view>;
         \`----
      ],
        ],
        "map": null,
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
        sourcemap: false,
        cssScope: false,
        snapshot: {
          runtimePkg: '@lynx-js/react-runtime',
          target: 'MIXED',
        },
        directiveDCE: false,
        defineDCE: false,
        shake: false,
        compat: true,
        worklet: false,
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
         ,-[2:1]
       1 | 
       2 | import { View } from "@lynx-js/react-components";
         : ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       3 | import { Unused } from "@lynx-js/react-components";
       4 | import { Component } from "@lynx-js/react-runtime";
       5 | Component, View
         \`----
      ",
          "  ! DEPRECATED: old package "@lynx-js/react-components" is removed
         ,-[3:1]
       1 | 
       2 | import { View } from "@lynx-js/react-components";
       3 | import { Unused } from "@lynx-js/react-components";
         : ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       4 | import { Component } from "@lynx-js/react-runtime";
       5 | Component, View
         \`----
      ",
          "  ! DEPRECATED: old runtime package "@lynx-js/react-runtime" is changed to "@lynx-js/react"
         ,-[4:1]
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
    expect(result.errors).toMatchInlineSnapshot(`[]`);
  });

  it('should not warn JSXSpread when not enable addComponentElement', async () => {
    const cfg = {
      sourcemap: false,
      cssScope: false,
      snapshot: {
        runtimePkg: '@lynx-js/react-runtime',
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
    };

    {
      cfg.compat.addComponentElement = false;
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
      expect(result.errors).toMatchInlineSnapshot(`[]`);
    }

    {
      cfg.compat.addComponentElement = {
        compilerOnly: true,
      };
      const result = await transformReactLynx(`<Comp {...s}/>;`, cfg);
      expect(result.warnings).toMatchInlineSnapshot(`
        [
          "  ! addComponentElement: component with JSXSpread is ignored to avoid badcase, you can switch addComponentElement.compilerOnly to false to enable JSXSpread support
           ,----
         1 | <Comp {...s}/>;
           :        ^^^
           \`----
        ",
        ]
      `);
      expect(result.errors).toMatchInlineSnapshot(`[]`);
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
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
      expect(result.errors).toMatchInlineSnapshot(`[]`);
      expect(result.code).toMatchInlineSnapshot(`
        "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        import * as ReactLynx from "@lynx-js/react-runtime";
        import * as ReactLynx1 from "@lynx-js/react/internal";
        const __snapshot_05fe4_4da58493_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_05fe4_4da58493_1", function() {
            const pageId = ReactLynx.__pageId;
            const el = __CreateView(pageId);
            return [
                el
            ];
        }, [
            (snapshot, index, oldValue)=>ReactLynx.updateSpread(snapshot, index, oldValue, 0)
        ], ReactLynx.__DynamicPartChildren_0, undefined, globDynamicComponentEntry, [
            0
        ]);
        /*#__PURE__*/ ReactLynx1.wrapWithLynxComponent((__c, __spread)=>/*#__PURE__*/ _jsx(__snapshot_05fe4_4da58493_1, {
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
    sourcemap: false,
    cssScope: false,
    snapshot: {
      runtimePkg: '@lynx-js/react-runtime',
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
  });

  it('should error when encounter <component/>', async () => {
    const cfg = __cfg();
    {
      cfg.compat.addComponentElement = true;
      const result = await transformReactLynx(
        `function A() { return <view><component/></view>; }`,
        cfg,
      );
      expect(result.warnings).toMatchInlineSnapshot(`[]`);
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
           ,----
         1 | class A extends Component { config = {}; render() {return <view/>;} }
           :                             ^^^^^^^^^^^^
           \`----
        ",
        ]
      `);
      expect(result.errors).toMatchInlineSnapshot(`[]`);
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
           ,-[1:1]
         1 | this.createSelectorQuery();
           : ^^^^^^^^^^^^^^^^^^^^^^^^^^
         2 |          this.getElementById();
           \`----
        ",
          "  ! BROKEN: getElementById on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead.
           ,-[2:1]
         1 | this.createSelectorQuery();
         2 |          this.getElementById();
           :          ^^^^^^^^^^^^^^^^^^^^^
           \`----
        ",
        ]
      `);
      expect(result.errors).toMatchInlineSnapshot(`[]`);
    }
  });
});

describe('syntaxConfig', () => {
  it('should allow C-style type cast in .ts', async () => {
    const result = await transformReactLynx(`const p = <any>Promise.all([]);`, {
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
    });
    expect(result.code).toMatchInlineSnapshot(`
      "Promise.all([]);
      "
    `);
  });

  it('should throw when using TS feature as TSX', async () => {
    const result = await transformReactLynx(`const p = <any>Promise.all([]);`, {
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
    });

    expect(result.code).toBe('');
    expect(result.warnings).toMatchInlineSnapshot(`[]`);
    expect(result.errors).toMatchInlineSnapshot(`
      [
        [Error:   x Unexpected token \`any\`. Expected jsx identifier
         ,----
       1 | const p = <any>Promise.all([]);
         :            ^^^
         \`----
      ],
      ]
    `);
  });

  it('should allow tsx-style type cast in .tsx', async () => {
    const result = await transformReactLynx(`const foo = <T,>(v: T) => v;foo`, {
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
        target: 'LEPUS',
        minSdkVersion: '2.14',
        runtimePkg: '@lynx-js/react',
      },
    });

    expect(result.code).toMatchInlineSnapshot(`
      "with (x)y;
      "
    `);
    expect(result.warnings).toMatchInlineSnapshot(`[]`);
    expect(result.errors).toMatchInlineSnapshot(`[]`);
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
      },
    );

    expect(result.warnings).toMatchInlineSnapshot(`
      [
        "  ! directive inside constructor is not allowed
         ,-[4:1]
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
          ,-[8:1]
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
          ,-[12:1]
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
    expect(result.errors).toMatchInlineSnapshot(`[]`);
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
      },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      let c = 1;
      const __snapshot_05fe4_fdcd539e_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_05fe4_fdcd539e_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry, null);
      export default class App extends Component {
          a() {}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_05fe4_fdcd539e_1, {});
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
      },
    );

    expect(result.code).toMatchInlineSnapshot(`""`);
    expect(result.warnings).toMatchInlineSnapshot(`[]`);
    expect(result.errors).toMatchInlineSnapshot(`
      [
        [Error:   x \`import()\` with no argument is not allowed
         ,-[2:1]
       1 | (async function () {
       2 |   await import();
         :         ^^^^^^^^
       3 |   await import(0);
       4 |   await import(0, 0);
       5 |   await import("./index.js", { with: { typo: "component" } });
         \`----
        x \`import(...)\` call with non-string literal module id is not allowed
         ,-[3:1]
       1 | (async function () {
       2 |   await import();
       3 |   await import(0);
         :         ^^^^^^^^^
       4 |   await import(0, 0);
       5 |   await import("./index.js", { with: { typo: "component" } });
       6 |   await import("https://www/a.js", { with: { typo: "component" } });
         \`----
        x \`import(...)\` call with non-string literal module id is not allowed
         ,-[4:1]
       1 | (async function () {
       2 |   await import();
       3 |   await import(0);
       4 |   await import(0, 0);
         :         ^^^^^^^^^^^^
       5 |   await import("./index.js", { with: { typo: "component" } });
       6 |   await import("https://www/a.js", { with: { typo: "component" } });
       7 |   await import(url, { with: { typo: "component" } });
         \`----
        x \`import("...", ...)\` with invalid options is not allowed
         ,-[5:1]
       2 |   await import();
       3 |   await import(0);
       4 |   await import(0, 0);
       5 |   await import("./index.js", { with: { typo: "component" } });
         :         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
       6 |   await import("https://www/a.js", { with: { typo: "component" } });
       7 |   await import(url, { with: { typo: "component" } });
       8 | })();
         \`----
      ],
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
      },
    );

    expect(
      result.code,
    ).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      const __snapshot_05fe4_6525c76e_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_05fe4_6525c76e_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry, null);
      class X extends Component {
          constructor(){}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_05fe4_6525c76e_1, {});
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
            target,
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
              _wkltId: "05fe:b88d3c29:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:b88d3c29:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["05fe:b88d3c29:1"].bind(this);
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
              _wkltId: "05fe:b88d3c29:1"
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
              _wkltId: "05fe:b88d3c29:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:b88d3c29:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["05fe:b88d3c29:1"].bind(this);
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
          _wkltId: "05fe:21759364:1"
      };
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:21759364:1", function(event) {
          const foo = lynxWorkletImpl._workletMap["05fe:21759364:1"].bind(this);
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
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      let foo = {
          _wkltId: "05fe:2ec866b7:1"
      };
      let bar = {
          _c: {
              foo
          },
          _wkltId: "05fe:2ec866b7:2"
      };
      console.log(bar);
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:2ec866b7:1", function() {
          const foo = lynxWorkletImpl._workletMap["05fe:2ec866b7:1"].bind(this);
          "main thread";
          return null;
      });
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:2ec866b7:2", function() {
          const bar = lynxWorkletImpl._workletMap["05fe:2ec866b7:2"].bind(this);
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
          runtimePkg: '@lynx-js/react',
        },
      },
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "05fe:b69521f0:1", function(event) {
          lynxWorkletImpl._workletMap["05fe:b69521f0:1"].bind(this);
          let { foo, a, b } = this["_c"];
          "main thread";
          if (foo(a)) foo(b);
          return null;
      });
      "
    `);
  });
});
