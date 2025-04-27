// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest';

import type { LynxStyleNode } from '@lynx-js/css-serializer';

import { cssChunksToMap } from '../src/css/cssChunksToMap.js';
import { debundleCSS } from '../src/css/debundle.js';
import { CSSPlugins } from '../src/index.js';
import { LynxEncodePlugin } from '../src/LynxEncodePlugin.js';

describe('CSS', () => {
  test('encodeCSS', async () => {
    const realJSONStringify = JSON.stringify;
    vi.mock('JSON');

    const encode = vi.fn().mockImplementation((str) => realJSONStringify(str));

    vi.spyOn(JSON, 'stringify').mockImplementation(
      (str: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return encode(str);
      },
    );

    await LynxEncodePlugin.encodeCSS([`.red { color: red; }`], {
      enableCSSSelector: false,
      targetSdkVersion: '3.2',
      enableRemoveCSSScope: true,
      enableCSSInvalidation: true,
    });

    expect(encode).toBeCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { compilerOptions, css: { cssMap, cssSource } } =
      encode.mock.calls[0]?.[0] ?? {};
    expect(compilerOptions).toStrictEqual(expect.objectContaining({
      enableFiberArch: true,
      useLepusNG: true,
    }));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(Object.entries(cssMap)).toHaveLength(1);
    expect(cssSource).toMatchInlineSnapshot(`
      {
        "0": "/cssId/0.css",
      }
    `);
  });

  describe('cssChunksToMap', () => {
    test('global styles only', () => {
      const { cssMap, cssSource } = cssChunksToMap(
        [
          `\
.foo { color: red; }
.bar { color: blue; }`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      expect(Object.keys(cssMap)).toMatchInlineSnapshot(`
        [
          "0",
        ]
      `);

      // Two StyleRules
      expect(getAllSelectors(cssMap[0])).toMatchInlineSnapshot(`
        [
          ".foo",
          ".bar",
        ]
      `);

      expect(cssSource).toMatchInlineSnapshot(`
        {
          "0": "/cssId/0.css",
        }
      `);
    });

    test('scoped styles only', () => {
      const { cssSource, cssMap } = cssChunksToMap(
        [
          `\
@cssId "1000" "foo.css" { .foo { color: red; } }
@cssId "1001" "bar.css" { .bar { color: blue; } }
@cssId "1000" "baz.css" { .baz { color: yellow; } }`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      // 1000 has 3 ImportRules
      // 0 -> common.css(global styles)
      expect(cssMap[0]).toBeUndefined();
      // 1 -> foo.css
      expect(getAllSelectors(cssMap[1])).toMatchInlineSnapshot(`
        [
          ".foo",
        ]
      `);
      // 3 -> baz.css
      expect(getAllSelectors(cssMap[3])).toMatchInlineSnapshot(`
        [
          ".baz",
        ]
      `);
      expect(cssMap[1000]).toMatchInlineSnapshot(`
        [
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
          {
            "href": "1",
            "origin": "1",
            "type": "ImportRule",
          },
          {
            "href": "3",
            "origin": "3",
            "type": "ImportRule",
          },
        ]
      `);

      // 1001 has 2 ImportRules
      // 0 -> common.css(global styles)
      expect(cssMap[0]).toBeUndefined();
      // 2 -> bar.css
      expect(getAllSelectors(cssMap[2])).toMatchInlineSnapshot(`
        [
          ".bar",
        ]
      `);
      expect(cssMap[1001]).toMatchInlineSnapshot(`
        [
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
          {
            "href": "2",
            "origin": "2",
            "type": "ImportRule",
          },
        ]
      `);

      expect(Object.keys(cssMap)).toMatchInlineSnapshot(`
        [
          "1",
          "2",
          "3",
          "1000",
          "1001",
        ]
      `);

      expect(cssSource).toMatchInlineSnapshot(`
        {
          "1": "/cssId/1.css",
          "1000": "/cssId/1000.css",
          "1001": "/cssId/1001.css",
          "2": "/cssId/2.css",
          "3": "/cssId/3.css",
        }
      `);
    });

    test('mixed global styles with scoped styles', () => {
      const { cssSource, cssMap } = cssChunksToMap(
        [
          `\
.root { background-color: black; }

@cssId "1000" "foo.css" { .foo { color: red; }  }
@cssId "1001" "bar.css" { .bar { color: blue; } }
@cssId "1000" "baz.css" { .baz { color: yellow; } }

.wrapper { display: flex; }
`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      expect(Object.keys(cssMap)).toMatchInlineSnapshot(`
        [
          "0",
          "1",
          "2",
          "3",
          "1000",
          "1001",
        ]
      `);

      // 1000 has 3 ImportRules
      // 0 -> common.css(global styles)
      expect(cssMap[0]).not.toBeUndefined();
      expect(getAllSelectors(cssMap[0])).toMatchInlineSnapshot(`
        [
          ".root",
          ".wrapper",
        ]
      `);
      // 1 -> foo.css
      expect(getAllSelectors(cssMap[1])).toMatchInlineSnapshot(`
        [
          ".foo",
        ]
      `);
      // 3 -> baz.css
      expect(getAllSelectors(cssMap[3])).toMatchInlineSnapshot(`
        [
          ".baz",
        ]
      `);
      expect(cssMap[1000]).toMatchInlineSnapshot(`
        [
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
          {
            "href": "1",
            "origin": "1",
            "type": "ImportRule",
          },
          {
            "href": "3",
            "origin": "3",
            "type": "ImportRule",
          },
        ]
      `);

      // 1001 has 2 ImportRules
      // 0 -> common.css(global styles)
      expect(getAllSelectors(cssMap[0])).toMatchInlineSnapshot(`
        [
          ".root",
          ".wrapper",
        ]
      `);
      // 2 -> bar.css
      expect(getAllSelectors(cssMap[2])).toMatchInlineSnapshot(`
        [
          ".bar",
        ]
      `);
      expect(cssMap[1001]).toMatchInlineSnapshot(`
        [
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
          {
            "href": "2",
            "origin": "2",
            "type": "ImportRule",
          },
        ]
      `);

      expect(cssSource).toMatchInlineSnapshot(`
        {
          "0": "/cssId/0.css",
          "1": "/cssId/1.css",
          "1000": "/cssId/1000.css",
          "1001": "/cssId/1001.css",
          "2": "/cssId/2.css",
          "3": "/cssId/3.css",
        }
      `);
    });

    test('mixed global styles with scoped styles when enableCSSSelector is false', () => {
      const { cssSource, cssMap } = cssChunksToMap(
        [
          `\
.root { background-color: black; }

@cssId "1000" "foo.css" { .foo { color: red; }  }
@cssId "1001" "bar.css" { .bar { color: blue; } }
@cssId "1000" "baz.css" { .baz { color: yellow; } }

.wrapper { display: flex; }
`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        false,
      );

      expect(Object.keys(cssMap)).toMatchInlineSnapshot(`
        [
          "0",
          "1",
          "2",
          "3",
          "1000",
          "1001",
        ]
      `);

      // 1000 has 3 ImportRules
      // 0 -> common.css(global styles)
      expect(cssMap[0]).not.toBeUndefined();
      expect(getAllSelectors(cssMap[0])).toMatchInlineSnapshot(`
        [
          ".root",
          ".wrapper",
        ]
      `);
      // 1 -> foo.css
      expect(getAllSelectors(cssMap[1])).toMatchInlineSnapshot(`
        [
          ".foo",
        ]
      `);
      // 3 -> baz.css
      expect(getAllSelectors(cssMap[3])).toMatchInlineSnapshot(`
        [
          ".baz",
        ]
      `);
      expect(cssMap[1000]).toMatchInlineSnapshot(`
        [
          {
            "href": "3",
            "origin": "3",
            "type": "ImportRule",
          },
          {
            "href": "1",
            "origin": "1",
            "type": "ImportRule",
          },
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
        ]
      `);

      // 1001 has 2 ImportRules
      // 0 -> common.css(global styles)
      expect(getAllSelectors(cssMap[0])).toMatchInlineSnapshot(`
        [
          ".root",
          ".wrapper",
        ]
      `);
      // 2 -> bar.css
      expect(getAllSelectors(cssMap[2])).toMatchInlineSnapshot(`
        [
          ".bar",
        ]
      `);
      expect(cssMap[1001]).toMatchInlineSnapshot(`
        [
          {
            "href": "2",
            "origin": "2",
            "type": "ImportRule",
          },
          {
            "href": "0",
            "origin": "0",
            "type": "ImportRule",
          },
        ]
      `);

      expect(cssSource).toMatchInlineSnapshot(`
        {
          "0": "/cssId/0.css",
          "1": "/cssId/1.css",
          "1000": "/cssId/1000.css",
          "1001": "/cssId/1001.css",
          "2": "/cssId/2.css",
          "3": "/cssId/3.css",
        }
      `);
    });

    test('remove css without data', () => {
      const { cssMap } = cssChunksToMap(
        [
          `\
.root { -webkit-appearance: black; }
`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      expect(cssMap[0]).toHaveLength(1);
      expect(cssMap[0]?.[0]).toHaveProperty('type', 'StyleRule');
    });

    test('remove css with non-compatible', () => {
      const { cssMap } = cssChunksToMap(
        [
          `\
.root { z-index: 10 }
`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      expect(cssMap[0]).toHaveLength(1);
      expect(cssMap[0]?.[0]).toHaveProperty('type', 'StyleRule');
    });

    test('not remove css variables', () => {
      const { cssMap } = cssChunksToMap(
        [
          `\
:root {
  --foo: red;
  --bar: blue;
  color: var(--red);
}
`,
        ],
        [CSSPlugins.parserPlugins.removeFunctionWhiteSpace()],
        true,
      );

      expect(cssMap[0]).toHaveLength(1);
      expect(cssMap[0]?.[0]).toHaveProperty('type', 'StyleRule');
      expect(cssMap[0]?.[0]).toHaveProperty('style', [
        expect.objectContaining({
          value: '{{--red}}',
        }),
      ]);
      expect(cssMap[0]?.[0]).toHaveProperty('variables', {
        '--foo': 'red',
        '--bar': 'blue',
      });
    });
  });

  describe('debundle', () => {
    test('debundle cssId', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          400004 => [
            "@import "0";
        @import "1";",
          ],
        }
      `);
    });

    test('debundle cssId when enableCSSSelector is false', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}
`,
        css,
        false,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          400004 => [
            "@import "1";
        @import "0";",
          ],
        }
      `);
    });

    test('debundle multiple cssId', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "1000" "bar.css" {
  .foo {
    color: red;
  }
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".foo{color:red}",
          ],
          400004 => [
            "@import "0";
        @import "1";",
          ],
          1000 => [
            "@import "0";
        @import "2";",
          ],
        }
      `);
    });

    test('debundle multiple cssId when enableCSSSelector is false', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "1000" "bar.css" {
  .foo {
    color: red;
  }
}
`,
        css,
        false,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".foo{color:red}",
          ],
          400004 => [
            "@import "1";
        @import "0";",
          ],
          1000 => [
            "@import "2";
        @import "0";",
          ],
        }
      `);
    });

    test('debundle multiple blocks with same cssId', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "/root/baz.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "400004" "foo.css" {
  .foo {
    color: red;
  }
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".foo{color:red}",
          ],
          400004 => [
            "@import "0";
        @import "1";
        @import "2";",
          ],
        }
      `);
    });

    test('debundle with blocks without cssId and cssId: 0', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "0" "common.css" {
  .bar {
    color: blue;
  }
}

.foo {
  color: red;
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          0 => [
            ".foo{color:red}",
            "@import "0";
        @import "2";",
          ],
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".bar{color:blue}",
          ],
          400004 => [
            "@import "0";
        @import "1";",
          ],
        }
      `);
    });

    test('debundle with blocks without cssId and cssId: 0 when enableCSSSelector is false', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "0" "common.css" {
  .bar {
    color: blue;
  }
}

.foo {
  color: red;
}
`,
        css,
        false,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          0 => [
            ".foo{color:red}",
            "@import "2";
        @import "0";",
          ],
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".bar{color:blue}",
          ],
          400004 => [
            "@import "1";
        @import "0";",
          ],
        }
      `);
    });

    test('debundle with blocks without cssId', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

.foo {
  color: red;
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          0 => [
            ".foo{color:red}",
          ],
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          400004 => [
            "@import "0";
        @import "1";",
          ],
        }
      `);
    });

    test('debundle with blocks without cssId when enableCSSSelector is false', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "400004" "foo.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

.foo {
  color: red;
}
`,
        css,
        false,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          0 => [
            ".foo{color:red}",
          ],
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          400004 => [
            "@import "1";
        @import "0";",
          ],
        }
      `);
    });

    test('minified(toLowerCase) cssId at-rule', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssid "400004" "foo/bar.css" {
  .split-line-wrapper .split-line__dark {
    background-color: rgba(255, 255, 255, 0.12);
  }
  .split-line-wrapper .split-line__light {
    background-color: rgba(22, 24, 35, 0.12);
  }
}

@cssId "400004" "foo/baz.css" {
  .foo {
    color: red;
  }
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          1 => [
            ".split-line-wrapper .split-line__dark{background-color:rgba(255,255,255,0.12)}.split-line-wrapper .split-line__light{background-color:rgba(22,24,35,0.12)}",
          ],
          2 => [
            ".foo{color:red}",
          ],
          400004 => [
            "@import "0";
        @import "1";
        @import "2";",
          ],
        }
      `);
    });

    test('empty cssId block', () => {
      const css = new Map<number, string[]>();
      debundleCSS(
        `\
@cssId "123" "empty.css" {
}

.foo {
  color: red;
}
`,
        css,
        true,
      );

      expect(css).toMatchInlineSnapshot(`
        Map {
          0 => [
            ".foo{color:red}",
          ],
          1 => [
            "",
          ],
          123 => [
            "@import "0";
        @import "1";",
          ],
        }
      `);
    });

    test('non-number file block', () => {
      const css = new Map<number, string[]>();

      expect(() =>
        debundleCSS(
          `\
@cssId "foo" "bar.css" {
  .bar {
    color: blue;
  }
}

.foo {
  color: red;
}
`,
          css,
          true,
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid cssId: @cssId "foo" "bar.css"]`,
      );
    });
  });
});

function getAllSelectors(nodes: LynxStyleNode[] | undefined): string[] {
  return nodes
    ?.filter(node => node.type === 'StyleRule')
    .map(styleRule => styleRule.selectorText.value) ?? [];
}
