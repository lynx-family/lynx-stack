import './jsdom.js';
import { describe, test, expect } from '@rstest/core';
import {
  encodeCSS,
  RawStyleInfo,
  Rule,
  Selector,
  RulePrelude,
} from '../ts/encode/encodeCSS.js';
import * as CSS from '@lynx-js/css-serializer';
import {
  get_style_content,
  get_font_face_content,
  decode_style_info,
} from '../binary/encode/encode.js';
import { encode, TasmJSONInfo } from '../ts/encode/webEncoder.js';
import { TemplateSectionLabel } from '../ts/constants.js';
import { loadStyleFromJSON } from '../ts/client/decodeWorker/cssLoader.js';
import { wasmInstance as clientWasmInstance } from '../ts/client/wasm.js';

const X_ELEMENT_ALIASES = [
  ['viewpager', 'x-viewpager-ng'],
  ['viewpager-item', 'x-viewpager-item-ng'],
  ['webview', 'x-webview'],
  ['overlay', 'x-overlay-ng'],
  ['refresh', 'x-refresh-view'],
  ['refresh-header', 'x-refresh-header'],
  ['blur-view', 'x-blur-view'],
  ['scroll-coordinator', 'x-foldview-ng'],
  ['scroll-coordinator-header', 'x-foldview-header-ng'],
  ['scroll-coordinator-slot', 'x-foldview-slot-ng'],
  ['scroll-coordinator-slot-drag', 'x-foldview-slot-drag-ng'],
  ['scroll-coordinator-toolbar', 'x-foldview-toolbar-ng'],
  ['input', 'x-input'],
  ['x-input-ng', 'x-input'],
  ['textarea', 'x-textarea'],
  ['x-textarea-ng', 'x-textarea'],
] as const;

describe('RawStyleInfo', () => {
  test('should encode StyleRule correctly', () => {
    const rawStyleInfo = new RawStyleInfo();

    const rule = new Rule('StyleRule');

    const selector = new Selector();
    selector.push_one_selector_section('ClassSelector', 'foo');

    const prelude = new RulePrelude();
    prelude.push_selector(selector);

    rule.set_prelude(prelude);

    rule.push_declaration('color', 'red');

    rawStyleInfo.push_rule(1, rule);

    const buffer = rawStyleInfo.encode();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should encode FontFaceRule correctly', () => {
    const rawStyleInfo = new RawStyleInfo();
    const rule = new Rule('FontFaceRule');

    rule.push_declaration('font-family', 'MyFont');

    rawStyleInfo.push_rule(1, rule);

    const buffer = rawStyleInfo.encode();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should handle imports correctly', () => {
    const rawStyleInfo = new RawStyleInfo();
    rawStyleInfo.append_import(1, 2);
    rawStyleInfo.push_rule(2, new Rule('StyleRule'));
    const buffer = rawStyleInfo.encode();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('legacy JSON CSS', () => {
  test('should transform XElement aliases in lynx-tag selectors', () => {
    const styleInfo = {
      '0': {
        content: [],
        rules: X_ELEMENT_ALIASES.map(([alias]) => ({
          sel: [[[`[lynx-tag="${alias}"]`], [], [], []]],
          decl: [['width', '1px'] as [string, string]],
        })),
      },
    };

    const decodedStyleInfo = loadStyleFromJSON(
      styleInfo,
      true,
      false,
      false,
      false,
    );
    const css = clientWasmInstance.get_style_content(decodedStyleInfo);

    for (const [, htmlTag] of X_ELEMENT_ALIASES) {
      expect(css).toContain(`${htmlTag}:not([l-e-name]){width:1px;}`);
    }
    expect(css).not.toContain('x-input-ng:not([l-e-name])');
    expect(css).not.toContain('x-textarea-ng:not([l-e-name])');
  });

  test('should keep @media groups', () => {
    // The shape `genStyleInfo` emits for
    // `.a{width:1px}@media (min-width:400px){.a{width:2px}@media (prefers-color-scheme:dark){view{width:3px}}}`
    const styleInfo = {
      '0': {
        content: [],
        rules: [
          { sel: [[['.a'], [], [], []]], decl: [['width', '1px']] },
          {
            media: '(min-width:400px)',
            rules: [
              { sel: [[['.a'], [], [], []]], decl: [['width', '2px']] },
              {
                media: '(prefers-color-scheme:dark)',
                rules: [
                  {
                    sel: [[['[lynx-tag="view"]'], [], [], []]],
                    decl: [['width', '3px']],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as Parameters<typeof loadStyleFromJSON>[0];

    const css = clientWasmInstance.get_style_content(
      loadStyleFromJSON(styleInfo, true, false, false, false),
    );

    expect(css).toBe(
      '.a:not([l-e-name]){width:1px;}'
        + '@media (min-width:400px){'
        + '.a:not([l-e-name]){width:2px;}'
        + '@media (prefers-color-scheme:dark){x-view:not([l-e-name]){width:3px;}}'
        + '}',
    );
  });
});

describe('encodeCSS', () => {
  test('should transform XElement alias type selectors', () => {
    const cssMap = {
      '0': CSS.parse(
        X_ELEMENT_ALIASES.map(([alias]) => `${alias} { width: 1px; }`).join(
          '\n',
        ),
      ).root,
    };

    const buffer = encodeCSS(cssMap);
    const css = get_style_content(
      decode_style_info(buffer, undefined, true),
    );

    for (const [, htmlTag] of X_ELEMENT_ALIASES) {
      expect(css).toContain(`${htmlTag}:not([l-e-name]){width:1px;}`);
    }
    expect(css).not.toContain('x-input-ng:not([l-e-name])');
    expect(css).not.toContain('x-textarea-ng:not([l-e-name])');
  });

  test('should encode basic StyleRule', () => {
    const css = `
      .foo {
        color: red;
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should encode FontFaceRule', () => {
    const css = `
      @font-face {
        font-family: "MyFont";
        src: url("myfont.woff");
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should encode ImportRule', () => {
    const css = `
      @import "2";
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
      '2': CSS.parse('.bar { color: blue; }').root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should encode KeyframesRule', () => {
    const css = `
      @keyframes my-animation {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should encode KeyframesRule with CSS variables', () => {
    const css = `
      @keyframes my-animation-with-vars {
        from {
          --my-var: 0;
          opacity: var(--my-var);
        }
        to {
          --my-var: 1;
          opacity: var(--my-var);
        }
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('should preserve fallback values in css var for keyframes', () => {
    const css = `
      @keyframes my-animation-with-vars-fallback {
        from {
          opacity: var(--my-var, .6);
        }
        to {
          opacity: var(--my-var, 1);
        }
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString).toContain('opacity:var(--my-var, .6);');
    expect(decodedString).toContain('opacity:var(--my-var, 1);');
  });

  test('should handle complex selectors', () => {
    const css = `
      div > .foo + #bar[attr="val"]::before:hover {
        color: blue;
      }
    `;
    const cssMap = {
      '0': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should handle :root selector', () => {
    const css = `
      :root {
        --main-color: black;
      }
    `;
    const cssMap = {
      '0': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should preserve fallback values in css var for color', () => {
    const css = `
      .foo {
        color: var(--Text-TextQuaternary, rgba(22, 24, 35, .6));
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString).toContain(
      'color:var(--Text-TextQuaternary, rgba(22,24,35,.6));',
    );
  });

  test('should preserve fallback values in css var for background-color', () => {
    const css = `
      .foo {
        background-color: var(--missing-bg-color, green);
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString).toContain(
      'background-color:var(--missing-bg-color, green);',
    );
  });

  test('should preserve nested fallback values in css var for background-color', () => {
    const css = `
      .foo {
        background-color: var(--missing-bg-color, var(--missing-bg-color-2, green));
      }
    `;
    const cssMap = {
      '1': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString).toContain(
      'background-color:var(--missing-bg-color, var(--missing-bg-color-2,green));',
    );
  });

  test('should handle ::placeholder selector', () => {
    const css = `
      input::placeholder {
        color: gray;
      }
    `;
    const cssMap = {
      '0': CSS.parse(css).root,
    };
    const buffer = encodeCSS(cssMap);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('should throw error for invalid cssId', () => {
    const css = `.foo { color: red; }`;
    const cssMap = {
      'invalid': CSS.parse(css).root,
    };
    expect(() => encodeCSS(cssMap)).toThrowError(/Invalid cssId/);
  });

  test('should throw error for invalid importCssId', () => {
    const css = `@import "invalid";`;
    const cssMap = {
      '0': CSS.parse(css).root,
    };
    expect(() => encodeCSS(cssMap)).toThrowError(/Invalid importCssId/);
  });

  test('normal css', () => {
    const cssMap = {
      '0': CSS.parse(`
        .foo {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });
  test(':root', () => {
    const cssMap = {
      '0': CSS.parse(`
        :root {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });
  test('complex-root', () => {
    const cssMap = {
      '0': CSS.parse(`
        .dark:root {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('font-family-at-rule', () => {
    const cssMap = {
      '0': CSS.parse(`
        @font-face {
          font-family: "MyFont";
          src: url("myfont.woff");
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_font_face_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('font-face should preserve fallback values in css var', () => {
    const cssMap = {
      '0': CSS.parse(`
        @font-face {
          font-family: var(--font-family, "MyFont");
          src: url("myfont.woff");
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_font_face_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString).toContain(
      'font-family:var(--font-family, "MyFont");',
    );
  });

  test('keyframes-rule', () => {
    const cssMap = {
      '0': CSS.parse(`
        @keyframes my-animation {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('media-rule', () => {
    const cssMap = {
      '0': CSS.parse(`
        .foo {
          width: 100rpx;
        }
        @media (min-width: 400px) {
          .foo, view {
            width: 200rpx;
          }
        }
        .bar {
          height: 1px;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toBe(
      '.foo:not([l-e-name]){width:calc(100 * var(--rpx-unit));}'
        + '@media (min-width:400px){'
        + '.foo:not([l-e-name]),x-view:not([l-e-name]){width:calc(200 * var(--rpx-unit));}'
        + '}'
        + '.bar:not([l-e-name]){height:1px;}',
    );
  });

  test('media-rule preludes', () => {
    // The queries used by the lynx-examples `css/media_query` demo.
    const queries = [
      '(min-resolution: 2dppx)',
      '(360px <= width < 400px)',
      '(min-width: 400px)',
      '(min-height: 700px)',
      '(prefers-color-scheme: dark)',
      'screen and (orientation: portrait), print',
    ];
    const cssMap = {
      '0': CSS.parse(
        queries.map((query) => `@media ${query} { .a { height: 1px; } }`)
          .join('\n'),
      ).root,
    };
    const decodedString = get_style_content(
      decode_style_info(encodeCSS(cssMap), undefined, true),
    );
    const preludes = [...decodedString.matchAll(/@media ([^{]*)\{/g)].map((
      [, prelude],
    ) => prelude);
    // Kept verbatim, whitespace aside; the web-core-e2e media query cases
    // check that a browser evaluates them.
    expect(preludes).toMatchSnapshot();
  });

  test('media-rule scoped by css id and entry name', () => {
    const cssMap = {
      '1': CSS.parse(`
        @media (prefers-color-scheme: dark) {
          .foo {
            height: 1px;
          }
        }
      `).root,
    };
    const decodedString = get_style_content(
      decode_style_info(encodeCSS(cssMap), 'lazy', true),
    );
    expect(decodedString.trim()).toBe(
      '@media (prefers-color-scheme:dark){.foo:where([l-css-id="1"])[l-e-name="lazy"]{height:1px;}}',
    );
  });

  test('media-rule with css selector disabled', () => {
    const cssMap = {
      '0': CSS.parse(`
        .foo {
          height: 1px;
        }
        @media (min-height: 700px) {
          .foo {
            height: 2px;
          }
        }
      `).root,
    };
    const decodedString = get_style_content(
      decode_style_info(encodeCSS(cssMap), undefined, false),
    );
    // The unconditional rule goes through the CSS OG map; the conditional one
    // has to stay a selector for the browser to evaluate the query.
    expect(decodedString.trim()).toBe(
      '{height:1px;}@media (min-height:700px){.foo:not([l-e-name]){height:2px;}}',
    );
  });

  test('scoped css', () => {
    const cssMap = {
      '1': CSS.parse(`
        .foo {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('scoped css, 2 css id', () => {
    const cssMap = {
      '1': CSS.parse(`
        @import "2";
      `).root,
      '2': CSS.parse(`
        .foo {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('scoped css, import non existing', () => {
    const cssMap = {
      '1': CSS.parse(`
        @import "20";
        @import "0";
      `).root,
      '2': CSS.parse(`
        @import "20";
      `).root,
      '20': CSS.parse(`
        .foo {
          background: red;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('css cascading order', () => {
    const cssMap = {
      '0': CSS.parse(`
        .foo {
          background: red;
        }
        .foo, .bar {
          height: 100px;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('no css', () => {
    const cssMap = {};
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toBe('');
  });

  test('non ascii characters', () => {
    const cssMap = {
      '0': CSS.parse(`
        .class145[data-status="complete"]:before {
          content: "✓ ";
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('complex combinator selector', () => {
    const cssMap = {
      '0': CSS.parse(`
        .parent > :not([hidden]) ~ :not([hidden]) {
          background-color: green;
        }
      `).root,
    };
    const buffer = encodeCSS(cssMap);
    const decodedString = get_style_content(
      decode_style_info(buffer, undefined, true),
    );
    expect(decodedString.trim()).toMatchSnapshot();
  });

  // test('cssog basic', () => {    const cssMap = {
  //   '0': CSS.parse(`
  //       .parent{
  //         background-color: green;
  //       }
  //     `).root,
  //   };
  //   const buffer = encodeCSS(cssMap);
  //    const decodedString = get_style_content(
  //     DecodedStyle.webWorkerDecode(buffer, true, undefined),
  //   );
  //   expect(decodedString.trim()).toBe('');
  // })
});

describe('webEncoder', () => {
  test('should skip elementTemplates section if empty', () => {
    const tasmJSON: TasmJSONInfo = {
      styleInfo: {},
      manifest: {},
      cardType: 'card',
      appType: 'card',
      pageConfig: {},
      lepusCode: {},
      customSections: {},
      elementTemplates: {},
    };
    const buffer = encode(tasmJSON);
    const view = new DataView(buffer.buffer);
    let offset = 8 + 4; // Magic + Version

    while (offset < buffer.byteLength) {
      const label = view.getUint32(offset, true);
      offset += 4;
      const length = view.getUint32(offset, true);
      offset += 4;
      if (label === TemplateSectionLabel.ElementTemplates) {
        throw new Error('ElementTemplates section should not be present');
      }
      offset += length;
    }
  });
});
