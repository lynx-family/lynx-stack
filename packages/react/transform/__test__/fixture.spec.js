// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { swcPluginCompat, swcPluginReactLynx, transformReactLynx } from '../main.js';

describe('shake', () => {
  it('should match', () => {
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

    const result = transformReactLynx(inputContent, [
      [
        swcPluginReactLynx,
        {},
      ],
    ]);

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

  it('should shake with/without jsx transform', () => {
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

    const result = transformReactLynx(inputContent, [
      [swcPluginCompat, {}],
      [
        swcPluginReactLynx,
        {
          mode: 'test',
          sourcemap: false,
          shake: true,
          directiveDCE: false,
        },
      ],
    ], {
      runtime: 'automatic',
    });

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
  });
});

describe('jsx', () => {
  it('should allow JSXNamespace', () => {
    const inputContent = 'const jsx = <Foo main-thread:foo={foo} />';
    const result = transformReactLynx(inputContent, [
      [
        swcPluginReactLynx,
        {
          mode: 'test',
          sourcemap: false,
          shake: true,
          worklet: true,
          directiveDCE: {
            target: 'LEPUS',
          },
        },
      ],
    ], {
      runtime: 'automatic',
    });

    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      /*#__PURE__*/ _jsx(Foo, {
          "main-thread:foo": foo
      });
      "
    `);
  });
});

describe('errors and warnings', () => {
  it('should handle error', () => {
    const inputContent = '<view>;';
    expect(() => {
      transformReactLynx(inputContent, [
        [
          swcPluginReactLynx,
          {},
        ],
      ]);
    }).toThrow(/Unexpected eof/);
  });

  it('should nodiff compat', () => {
    const inputContent = `
import { View } from "@lynx-js/react-components";
import { Unused } from "@lynx-js/react-components";
import { Component } from "@lynx-js/react-runtime";
Component, View
    `;

    const result = transformReactLynx(inputContent, [
      [swcPluginCompat, {}],
      [
        swcPluginReactLynx,
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
          worklet: false,
        },
      ],
    ]);

    expect(result.code).toMatchInlineSnapshot(
      `
      "import { Component } from "@lynx-js/react/legacy-react-runtime";
      Component, View;
      "
    `,
    );
  });

  it('should format message', () => {
    const result = transformReactLynx(`<view style="invalid: true;"/>;`, [[swcPluginReactLynx, {}]]);
    // Should not have `__AddInlineStyle`
    expect(result.code).not.toContain(`__AddInlineStyle`);
    // Should have __SetInlineStyles(element, "invalid: true")
    expect(result.code).toContain('invalid: true');
  });

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
    worklet: false,
  };

  const compatCfg = {
    target: 'LEPUS',
    componentsPkg: ['@lynx-js/react-components'],
    oldRuntimePkg: ['@lynx-js/react-runtime'],
    newRuntimePkg: '@lynx-js/react',
    additionalComponentAttributes: [],
    addComponentElement: true,
    simplifyCtorLikeReactLynx2: false,
    disableDeprecatedWarning: false,
  };

  it('should not warn JSXSpread when not enable addComponentElement', () => {
    {
      compatCfg.addComponentElement = false;
      const result = transformReactLynx(`<Comp {...s}/>;`, [
        [swcPluginCompat, compatCfg],
        [swcPluginReactLynx, cfg],
      ], { runtime: 'automatic' });

      expect(result.code).toMatchInlineSnapshot(`
        "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        _jsx(Comp, {
            ...s
        });
        "
      `);
    }

    {
      compatCfg.addComponentElement = {
        compilerOnly: true,
      };
      const result = transformReactLynx(`<Comp {...s}/>;`, [
        [swcPluginCompat, compatCfg],
        [swcPluginReactLynx, cfg],
      ], { runtime: 'automatic' });

      // TODO(BitterGourd): migrate to rspeedy tests
      //     expect(
      //       await formatMessages(result.warnings, {
      //         kind: 'warning',
      //         color: false,
      //       }),
      //     ).toMatchInlineSnapshot(`
      //       [
      //         "▲ [WARNING] addComponentElement: component with JSXSpread is ignored to avoid badcase, you can switch addComponentElement.compilerOnly to false to enable JSXSpread support

      //           :1:7:
      //             1 │ <Comp {...s}/>;
      //               ╵        ~~~

      //       ",
      //       ]
      //     `);

      expect(result.code).toMatchInlineSnapshot(`
          "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
          _jsx(Comp, {
              ...s
          });
          "
        `);
    }

    {
      compatCfg.addComponentElement = false;
      const result = transformReactLynx(`<Comp {...s}/>;`, [
        [swcPluginCompat, compatCfg],
        [swcPluginReactLynx, cfg],
      ], { runtime: 'automatic' });

      expect(result.code).toMatchInlineSnapshot(`
        "/*#__PURE__*/ import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
        _jsx(Comp, {
            ...s
        });
        "
      `);
    }
  });

  it('should error when encounter <component/>', () => {
    {
      const result = transformReactLynx(
        `function A() { return <view><component/></view>; }`,
        [
          [swcPluginCompat, compatCfg],
          [swcPluginReactLynx, cfg],
        ],
        { runtime: 'automatic' },
      );

      expect(result.code).toMatchInlineSnapshot(`
        "import * as ReactLynx from "@lynx-js/react";
        /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_a76160c5_1", function() {
            const pageId = ReactLynx.__pageId;
            const el = __CreateView(pageId);
            const el1 = __CreateElement("component", pageId);
            __AppendElement(el, el1);
            return [
                el,
                el1
            ];
        }, null, null, undefined, globDynamicComponentEntry);
        "
      `);
    }
  });

  // TODO(BitterGourd): migrate to rspeedy tests
  // it('should error when encounter class property config', async () => {
  //   const { formatMessages } = await import('esbuild');

  //   const cfg = __cfg();
  //   {
  //     const result = await transformReactLynx(
  //       `class A extends Component { config = {}; render() {return <view/>;} }`,
  //       cfg,
  //     );
  //     expect(
  //       await formatMessages(result.warnings, {
  //         kind: 'warning',
  //         color: false,
  //       }),
  //     ).toMatchInlineSnapshot(`
  //       [
  //         "▲ [WARNING] BROKEN: supporting for class property \`config\` is removed and MUST be migrated in ReactLynx 3.0, you should put your configs inside \`pageConfig\` in lynx.config.js [plugin transform]

  //           :1:28:
  //             1 │ class A extends Component { config = {}; render() {return <view/>;} }
  //               ╵                             ~~~~~~~~~~~~

  //       ",
  //       ]
  //     `);
  //   }
  // });

  // it('should warning when encounter this.createSelectorQuery', async () => {
  //   const { formatMessages } = await import('esbuild');

  //   const cfg = __cfg();
  //   {
  //     const result = await transformReactLynx(
  //       `this.createSelectorQuery();
  //        this.getElementById();`,
  //       cfg,
  //     );
  //     expect(
  //       await formatMessages(result.warnings, {
  //         kind: 'warning',
  //         color: false,
  //       }),
  //     ).toMatchInlineSnapshot(`
  //       [
  //         "▲ [WARNING] BROKEN: createSelectorQuery on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead. [plugin transform]

  //           :1:0:
  //             1 │ this.createSelectorQuery();
  //               ╵ ~~~~~~~~~~~~~~~~~~~~~~~~~~

  //       ",
  //         "▲ [WARNING] BROKEN: getElementById on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead. [plugin transform]

  //           :2:9:
  //             2 │          this.getElementById();
  //               ╵          ~~~~~~~~~~~~~~~~~~~~~

  //       ",
  //       ]
  //     `);
  //   }
  // });
});

describe('transformBundle', () => {
  it('should allow C-style type cast in .ts', () => {
    const result = transformReactLynx(
      `const p = <any>Promise.all([]);`,
      [
        [swcPluginReactLynx, {
          pluginName: 'transform',
          filename: '',
          sourcemap: false,
          cssScope: false,
          jsx: false,
          directiveDCE: false,
          defineDCE: false,
          shake: true,
          worklet: false,
        }],
      ],
      {},
      { syntax: 'typescript', tsx: false },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "Promise.all([]);
      "
    `);
  });

  it('should throw when using TS feature as TSX', () => {
    expect(() => {
      transformReactLynx(
        `const p = <any>Promise.all([]);`,
        [
          [swcPluginReactLynx, {
            pluginName: 'transform',
            filename: '',
            sourcemap: false,
            cssScope: false,
            jsx: false,
            directiveDCE: false,
            defineDCE: false,
            shake: true,
            worklet: false,
          }],
        ],
        {},
        { syntax: 'typescript', tsx: true },
      );
    }).toThrowError('Unexpected token `any`. Expected jsx identifier');
  });

  it('should allow tsx-style type cast in .tsx', () => {
    const result = transformReactLynx(
      `const foo = <T,>(v: T) => v;foo`,
      [
        [swcPluginReactLynx, {
          pluginName: 'transform',
          filename: '',
          sourcemap: false,
          cssScope: false,
          jsx: false,
          directiveDCE: false,
          defineDCE: false,
          shake: true,
          worklet: false,
        }],
      ],
      {},
      { syntax: 'typescript', tsx: true },
    );

    // Note that the result is not valid TSX code, but it is valid TS code.
    expect(result.code).toMatchInlineSnapshot(`
      "const foo = (v)=>v;
      foo;
      "
    `);
  });

  it('should compile when using with', () => {
    expect(() => {
      transformReactLynx(
        `with(x) {y}`,
        [
          [swcPluginReactLynx, {
            pluginName: '',
            filename: '',
            sourcemap: false,
            cssScope: false,
            jsx: false,
            directiveDCE: false,
            defineDCE: false,
            shake: true,
            worklet: {
              filename: 'filename',
              target: 'LEPUS',
              minSdkVersion: '2.14',
              runtimePkg: '@lynx-js/react',
            },
          }],
        ],
        {},
        { syntax: 'ecmascript', jsx: false },
        {
          isModule: false,
        },
      );
    }).not.toThrowError();
  });
});

// TODO(BitterGourd): migrate to rspeedy tests
// describe('directive dce', () => {
//   it('directive dce warning', async () => {
//     const result = await transformReactLynx(
//       `
// class X {
//   constructor() {
//     'use js only';
//     console.log("js only");
//   }
//   get xxx() {
//     'use js only';
//     return 'js only';
//   }
//   set xxx(v) {
//     'use js only';
//   }
// }
// `,
//       {
//         pluginName: '',
//         filename: '',
//         sourcemap: false,
//         cssScope: false,
//         jsx: false,
//         directiveDCE: {
//           target: 'LEPUS',
//         },
//         defineDCE: false,
//         shake: false,
//         compat: true,
//         worklet: false,
//         refresh: false,
//       },
//     );

//     expect(
//       await formatMessages(result.warnings, { kind: 'warning', color: false }),
//     ).toMatchInlineSnapshot(`
//       [
//         "▲ [WARNING] directive inside constructor is not allowed

//           :4:4:
//             4 │     'use js only';
//               ╵     ~~~~~~~~~~~~~~

//       ",
//         "▲ [WARNING] directive inside getter/setter is ignored

//           :8:4:
//             8 │     'use js only';
//               ╵     ~~~~~~~~~~~~~~

//       ",
//         "▲ [WARNING] directive inside getter/setter is ignored

//           :12:4:
//             12 │     'use js only';
//                ╵     ~~~~~~~~~~~~~~

//       ",
//       ]
//     `);
//   });
// });

describe('simplifyCtorLikeReactLynx2', () => {
  it('enable', () => {
    const result = transformReactLynx(
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
      [
        [swcPluginCompat, {
          target: 'LEPUS',
          componentsPkg: ['@lynx-js/react-components'],
          oldRuntimePkg: ['@lynx-js/react-runtime'],
          newRuntimePkg: '@lynx-js/react',
          additionalComponentAttributes: [],
          addComponentElement: true,
          simplifyCtorLikeReactLynx2: true,
          disableDeprecatedWarning: false,
        }],
        [swcPluginReactLynx, {
          pluginName: 'transform',
          filename: '',
          sourcemap: false,
          cssScope: false,
          jsx: false,
          directiveDCE: false,
          defineDCE: false,
          shake: true,
          worklet: false,
        }],
      ],
      {
        runtime: 'automatic',
      },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      let c = 1;
      const __snapshot_da39a_fdcd539e_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_fdcd539e_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
      export default class App extends Component {
          a() {}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_fdcd539e_1, {});
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
  it('bad case', () => {
    expect(() => {
      transformReactLynx(
        `\
    (async function () {
      await import();
    })();
    `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).toThrow(/`import\(\)` with no argument is not allowed/);

    expect(() => {
      transformReactLynx(
        `\
  (async function () {
    await import(0);
  })();
  `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).toThrow(/`import\(\.\.\.\)` call with non-string literal module id is not allowed/);

    expect(() => {
      transformReactLynx(
        `\
    (async function () {
      await import(0,0);
    })();
    `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).toThrow(/`import\(\.\.\.\)` call with non-string literal module id is not allowed/);

    expect(() => {
      transformReactLynx(
        `\
    (async function () {
      await import("./index.js", { with: { typo: "component" } });
    })();
    `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).toThrow(/`import\("\.\.\.", \.\.\.\)` with invalid options is not allowed/);

    expect(() => {
      transformReactLynx(
        `\
    (async function () {
          await __dynamicImport("https://www/a.js", {
              with: {
                  typo: "component"
              }
          });
    })();
    `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).not.toThrowError();

    expect(() => {
      transformReactLynx(
        `\
    (async function () {
          await __dynamicImport("url", {
              with: {
                  typo: "component"
              }
          });
    })();
    `,
        [
          [
            swcPluginReactLynx,
            {},
          ],
        ],
      );
    }).not.toThrowError();
  });
});

describe('define dce', () => {
  it('define dce should work - basic', () => {
    const inputContent = `
function X() {
  if (__LEPUS__) {
    return;
  }
  console.log("xxx");
}

X();
`;
    const result = transformReactLynx(inputContent, [
      [swcPluginCompat, {}],
      [swcPluginReactLynx, {
        sourcemap: false,
        cssScope: false,
        shake: false,
        worklet: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
      }],
    ]);

    expect(result.code).toMatchInlineSnapshot(`
      "function X() {
          return;
      }
      X();
      "
    `);
  });

  it('define dce should work - with && ||', () => {
    const inputContent = `
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
    `;
    const result = transformReactLynx(
      inputContent,
      [[swcPluginCompat, {}], [swcPluginReactLynx, {
        cssScope: false,
        shake: false,
        worklet: false,
        directiveDCE: false,
        defineDCE: {
          define: {
            __LEPUS__: 'true',
            __JS__: 'false',
          },
        },
      }]],
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

  it('define dce should work - with import', () => {
    const inputContent = `
  import { x } from "./a"
  function X() {
    if (__LEPUS__ || 0) {
      return;
    }
    x();
  }
  
  X();
  `;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: false,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
        }],
      ],
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

  it('define dce should work - with typeof', () => {
    const inputContent = `
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
`;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: false,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
        }],
      ],
    );

    expect(result.code).toMatchInlineSnapshot(`
      "function X() {
          console.log("boolean");
          console.log(typeof __NON_EXISTS__);
          console.log("xxx");
      }
      X();
      "
    `);
  });

  it('define dce should work - with typeof', () => {
    const inputContent = `
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
`;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: false,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
        }],
      ],
    );

    expect(result.code).toMatchInlineSnapshot(`
      "function X() {
          console.log("boolean");
          console.log(typeof __NON_EXISTS__);
          console.log("xxx");
      }
      X();
      "
    `);
  });

  it('define dce should work - should recursive', () => {
    const inputContent = `
  function X() {
    console.log(typeof __LEPUS__)
    console.log(typeof __NON_EXISTS__)
    console.log(typeof __NON_EXISTS_2__)
  }

  X();
  `;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: false,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __NON_EXISTS__: '__LEPUS__',
              __NON_EXISTS_2__: '__NON_EXISTS__',
            },
          },
        }],
      ],
    );

    expect(result.code).toMatchInlineSnapshot(`
        "function X() {
            console.log("boolean");
            console.log("boolean");
            console.log("boolean");
        }
        X();
        "
      `);
  });

  it('define dce should work - shorthand object property', () => {
    const inputContent = `
function X() {
  return {
    __LEPUS__
  }
}

X();
`;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: false,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
            },
          },
        }],
      ],
    );

    expect(result.code).toMatchInlineSnapshot(`
      "function X() {
          return {
              __LEPUS__: true
          };
      }
      X();
      "
    `);
  });

  it('define dce should work - with shake', () => {
    const inputContent = `
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
`;
    const result = transformReactLynx(
      inputContent,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          cssScope: false,
          shake: true,
          worklet: false,
          directiveDCE: false,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
        }],
      ],
      {
        runtime: 'automatic',
      },
    );

    expect(result.code).toMatchInlineSnapshot(`
      "import { jsx as _jsx } from "@lynx-js/react/jsx-runtime";
      import * as ReactLynx from "@lynx-js/react";
      const __snapshot_da39a_6525c76e_1 = /*#__PURE__*/ ReactLynx.createSnapshot("__snapshot_da39a_6525c76e_1", function() {
          const pageId = ReactLynx.__pageId;
          const el = __CreateView(pageId);
          return [
              el
          ];
      }, null, null, undefined, globDynamicComponentEntry);
      class X extends Component {
          constructor(){}
          render() {
              return /*#__PURE__*/ _jsx(__snapshot_da39a_6525c76e_1, {});
          }
      }
      /*#__PURE__*/ _jsx(X, {});
      "
    `);
  });
});

describe('worklet', () => {
  for (const target of ['LEPUS', 'JS', 'MIXED']) {
    it('member expression', () => {
      const { code } = transformReactLynx(
        `\
export function getCurrentDelta(event) {
  "main thread";
  return foo.bar.baz;
}
`,
        [
          [swcPluginCompat, {}],
          [swcPluginReactLynx, {
            pluginName: '',
            filename: '',
            sourcemap: false,
            cssScope: false,
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
              filename: '',
              runtimePkg: '@lynx-js/react',
            },
          }],
        ],
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
              _lepusWorkletHash: "da39:10e67d6f:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:10e67d6f:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:10e67d6f:1"].bind(this);
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
              _wkltId: "da39:10e67d6f:1"
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
              _wkltId: "da39:10e67d6f:1"
          };
          loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:10e67d6f:1", function(event) {
              const getCurrentDelta = lynxWorkletImpl._workletMap["da39:10e67d6f:1"].bind(this);
              let { foo } = this["_c"];
              "main thread";
              return foo.bar.baz;
          });
          "
        `);
      }
    });
  }

  it('member expression with multiple times', () => {
    const { code } = transformReactLynx(
      `\
export function foo(event) {
  "main thread";
  return bar.baz['qux'] || bar.qux['baz'] || qux.bar.baz;
}
`,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
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
          worklet: {
            target: 'LEPUS',
            filename: '',
            runtimePkg: '@lynx-js/react',
          },
        }],
      ],
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
          _lepusWorkletHash: "da39:21759364:1"
      };
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:21759364:1", function(event) {
          const foo = lynxWorkletImpl._workletMap["da39:21759364:1"].bind(this);
          let { bar, qux } = this["_c"];
          "main thread";
          return bar.baz['qux'] || bar.qux['baz'] || qux.bar.baz;
      });
      "
    `);
  });

  it('nested', () => {
    const { code } = transformReactLynx(
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
      [
        [swcPluginReactLynx, {
          sourcemap: false,
          cssScope: false,
          directiveDCE: true,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
          shake: false,
          worklet: {
            target: 'LEPUS',
            filename: '',
            runtimePkg: '@lynx-js/react',
          },
        }],
      ],
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      let foo = {
          _lepusWorkletHash: "da39:2ec866b7:1"
      };
      let bar = {
          _c: {
              foo
          },
          _lepusWorkletHash: "da39:2ec866b7:2"
      };
      console.log(bar);
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:2ec866b7:1", function() {
          const foo = lynxWorkletImpl._workletMap["da39:2ec866b7:1"].bind(this);
          "main thread";
          return null;
      });
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:2ec866b7:2", function() {
          const bar = lynxWorkletImpl._workletMap["da39:2ec866b7:2"].bind(this);
          let { foo } = this["_c"];
          "main thread";
          foo();
      });
      "
    `);
  });

  it('use multiple times', () => {
    const { code } = transformReactLynx(
      `\
function getCurrentDelta(event) {
  "main thread";
  if (foo(a)) {
    if (foo(b)) {}
  }
  return null;
}
`,
      [
        [swcPluginCompat, {}],
        [swcPluginReactLynx, {
          pluginName: '',
          filename: '',
          sourcemap: false,
          cssScope: false,
          directiveDCE: true,
          defineDCE: {
            define: {
              __LEPUS__: 'true',
              __JS__: 'false',
            },
          },
          shake: false,
          worklet: {
            target: 'LEPUS',
            filename: '',
            runtimePkg: '@lynx-js/react',
          },
        }],
      ],
    );

    expect(code).toMatchInlineSnapshot(`
      "import { loadWorkletRuntime as __loadWorkletRuntime } from "@lynx-js/react";
      var loadWorkletRuntime = __loadWorkletRuntime;
      loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal("main-thread", "da39:b69521f0:1", function(event) {
          lynxWorkletImpl._workletMap["da39:b69521f0:1"].bind(this);
          let { foo, a, b } = this["_c"];
          "main thread";
          if (foo(a)) foo(b);
          return null;
      });
      "
    `);
  });
});
