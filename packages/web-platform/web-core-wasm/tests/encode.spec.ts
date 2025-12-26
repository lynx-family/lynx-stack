import './jsdom.js';
import { describe, test, expect } from 'vitest';
import {
  encodeCSS,
  RawStyleInfo,
  Rule,
  Selector,
  RulePrelude,
} from '../ts/encode/encodeCSS.js';
import * as CSS from '@lynx-js/css-serializer';
import { DecodedStyle, wasmReadyPromise } from '../ts/client/wasm.js';
await wasmReadyPromise;

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

describe('encodeCSS', () => {
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .font_face_content;
    expect(decodedString.trim()).toMatchSnapshot();
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
    expect(decodedString.trim()).toMatchSnapshot();
  });

  test('no css', () => {
    const cssMap = {};
    const buffer = encodeCSS(cssMap);
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
    const decodedString =
      new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined))
        .style_content;
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
  //   const decodedString = new DecodedStyle(DecodedStyle.webWorkerDecode(buffer, true, undefined)).style_content;
  //   expect(decodedString.trim()).toBe('');
  // })
});
