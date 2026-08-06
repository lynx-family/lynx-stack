// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Coverage for tokenizing a buildless card's CSS.
 *
 * These tests drive the real style pipeline - `xmlToTemplate` ->
 * `loadStyleFromJSON` -> the wasm style encoder - and assert on the CSS text the
 * engine ends up producing, because that text is the only place the rewrites
 * this feature exists for are observable.
 */

import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';

rstest.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
  simd: async () => true,
}));

await import('../ts/client/wasm.js');
const { loadStyleFromJSON } = await import(
  '../ts/client/decodeWorker/cssLoader.js'
);
const { xmlToTemplate } = await import(
  '../ts/client/decodeWorker/xmlTemplate.js'
);
const { convertCSSToStyleInfo } = await import(
  '../ts/common/xml/cssToStyleInfo.js'
);

/** Wraps a stylesheet in the smallest card that carries one. */
function card(css: string): string {
  return `<lynx version="5.4.2"><style><![CDATA[${css}]]></style>`
    + `<script main-thread="true"><![CDATA[ x ]]></script></lynx>`;
}

/**
 * The CSS text the style engine produces for a card's stylesheet.
 *
 * The encoded section is a binary buffer whose style text is stored as plain
 * UTF-8, so decoding it and cutting at the first NUL yields exactly the CSS the
 * engine will install.
 */
function engineCSS(
  css: string,
  transform: { vw?: boolean; vh?: boolean; rem?: boolean } = {},
): string {
  const result = xmlToTemplate(card(css));
  if (!result.success) {
    throw new Error(result.message);
  }
  const buffer = loadStyleFromJSON(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.template.styleInfo as any,
    true,
    transform.vw ?? false,
    transform.vh ?? false,
    transform.rem ?? false,
    undefined,
  );
  const decoded = new TextDecoder().decode(buffer);
  const end = decoded.indexOf('\u0000');
  return end === -1 ? decoded : decoded.slice(0, end);
}

describe('markup card CSS tokenization', () => {
  /**
   * Limitation 1. `transform-rem` / `transform-vw` make the engine rewrite
   * lengths so they resolve against the lynx-view box rather than the browser
   * viewport. The rewrite happens while tokenizing, so it only reaches a card
   * whose CSS is tokenized.
   */
  test('applies `transform-rem` to a markup card', () => {
    expect(engineCSS('.card { padding: 1rem; }', { rem: true }))
      .toContain('padding:calc(1 * var(--rem-unit));');

    // Same input, attribute off: the unit is left as the author wrote it. This
    // is the half that proves the rewrite is driven by the attribute and not
    // unconditional.
    const untransformed = engineCSS('.card { padding: 1rem; }', { rem: false });
    expect(untransformed).toContain('padding:1rem;');
    expect(untransformed).not.toContain('--rem-unit');
  });

  test('applies `transform-vw` to a markup card, including inside `calc()`', () => {
    const transformed = engineCSS(
      '.card { width: 50vw; font-size: calc(100vw / 24); }',
      { vw: true },
    );
    expect(transformed).toContain('width:calc(50 * var(--vw-unit));');
    // A `vw` nested in the author's own `calc()` has to be rewritten in place,
    // which is why this asserts the nested form rather than just the substring.
    expect(transformed).toMatch(
      /font-size:calc\(calc\(100 \* var\(--vw-unit\)\)\s*\/\s*24\);/,
    );

    const untransformed = engineCSS('.card { width: 50vw; }', { vw: false });
    expect(untransformed).toContain('width:50vw;');
    expect(untransformed).not.toContain('--vw-unit');
  });

  /**
   * Limitation 2. `display: linear` is Lynx-specific and has no meaning to a
   * browser, which drops the declaration as invalid and falls back to `display:
   * block` - collapsing the intended layout. The Lynx `style_transformer`
   * translates it, and only runs on tokenized declarations.
   */
  test('translates Lynx-specific `display: linear`', () => {
    const css = engineCSS(
      '.card { display: linear; linear-direction: column; }',
    );

    // The browser-facing result is a flex container ...
    expect(css).toContain('display:flex;');
    // ... plus the custom properties the web element implementation keys its
    // linear layout off. Asserting these rather than only `display:flex` is what
    // distinguishes a real translation from the author having written `flex`.
    expect(css).toContain('--lynx-display:linear;');
    expect(css).toContain('--lynx-display-toggle:var(--lynx-display-linear);');
    expect(css).toContain('--lynx-linear-orientation:vertical;');

    // `linear-direction` is Lynx-only and must not survive as an unknown
    // property; it is expressed through `--lynx-linear-orientation` instead.
    expect(css).not.toContain('linear-direction');
    // The author's `display: linear` must not reach the browser as a real
    // `display` declaration, which would be invalid and collapse the layout.
    // Matched with the leading `;` / `{` so this does not trip over the
    // `--lynx-display:linear` custom property, which legitimately contains the
    // same substring.
    expect(css).not.toMatch(/[;{]display:linear/);
  });

  /**
   * Limitation 3. A card renders inside a shadow root, where a literal `:root`
   * matches nothing at all, so the engine rewrites it to the card's own root
   * element. Without the rewrite every declaration under `:root` - custom
   * properties included - is silently unreachable.
   */
  test('rewrites `:root` to the card root', () => {
    const css = engineCSS(':root { --accent: #2f6d54; color: red; }');

    expect(css).toContain('[part="page"]');
    expect(css).toMatch(/--accent:\s*#2f6d54;/);
    // The literal selector must be gone, otherwise it would still match nothing.
    expect(css).not.toContain(':root');
  });

  test('resolves a `var()` declared under `:root` from a class rule', () => {
    // The end-to-end shape of limitation 3: a custom property declared on
    // `:root` and read elsewhere. Both halves have to land on the card for the
    // `var()` to resolve.
    const css = engineCSS(
      ':root { --accent: #2f6d54; } .tab { background-color: var(--accent); }',
    );
    expect(css).toContain('[part="page"]');
    expect(css).toMatch(/--accent:\s*#2f6d54;/);
    expect(css).toContain('background-color:var(--accent);');
    // A missing placeholder restore would emit `{{--accent}}` here instead.
    expect(css).not.toContain('{{');
  });

  describe('CSS custom properties', () => {
    test('restores `var()` with and without a fallback', () => {
      // `var()` has to survive tokenization as real CSS, fallback included.
      const css = engineCSS(
        '.a { color: var(--c); } .b { color: var(--d, blue); }'
          + ' .c { width: calc(var(--w) * 2); }',
      );
      expect(css).toContain('color:var(--c);');
      expect(css).toMatch(/color:var\(--d,\s*blue\);/);
      expect(css).toContain('var(--w)');
      // The `{{--name}}` placeholder form is an internal interchange format of
      // `@lynx-js/css-serializer` and must never reach the encoder.
      expect(css).not.toContain('{{');
    });
  });

  test('keeps `!important` on a declaration', () => {
    // `css-tree` reports `!important` separately from the value, so it has to be
    // re-appended explicitly or the declaration silently loses its priority.
    const css = engineCSS('.a { color: red !important; }');
    expect(css).toContain('!important');
  });

  describe('at-rules the binary format cannot represent', () => {
    /**
     * The binary style format's rule kinds are `StyleRule` / `FontFaceRule` /
     * `KeyframesRule` only, so a conditional group rule cannot be tokenized.
     * `css-serializer` parses `@media` happily and reports no error, so a
     * converter that simply ignored unknown node types would drop the block
     * without any signal - hence these tests.
     */
    test('preserves `@media` verbatim instead of dropping it', () => {
      const css = engineCSS(
        '.a { color: red; } @media (min-width: 600px) { .a { color: blue; } }',
      );
      // The block reaches the browser, which honours it natively.
      expect(css).toMatch(/@media \(min-width:\s*600px\)/);
      expect(css).toContain('color:blue');
    });

    test('preserves `@supports` and `@layer` verbatim', () => {
      const supports = engineCSS(
        '@supports (display: grid) { .a { color: red; } }',
      );
      expect(supports).toMatch(/@supports \(display:\s*grid\)/);
      expect(supports).toContain('color:red');

      const layer = engineCSS('@layer base { .a { color: red; } }');
      expect(layer).toContain('@layer base');
      expect(layer).toContain('color:red');
    });

    test('preserves a non-numeric `@import` rather than failing the card', () => {
      // `encodeCSS`'s import handling does `Number(href)` and throws when that
      // is `NaN`. Inside the decode worker a throw fails the whole card, so an
      // authored `@import url("theme.css")` must not reach it.
      expect(() => engineCSS('@import url("theme.css"); .a { color: red; }'))
        .not.toThrow();
      const css = engineCSS('@import url("theme.css"); .a { color: red; }');
      expect(css).toContain('@import url("theme.css")');
      expect(css).toContain('color:red;');
    });

    test('reports which at-rule kinds stayed verbatim', () => {
      const { verbatimKinds } = convertCSSToStyleInfo(
        '.a { color: red; }'
          + ' @media screen { .a { color: blue; } }'
          + ' @supports (display: grid) { .a { display: grid; } }'
          + ' @layer base { .a { color: green; } }',
      );
      expect(verbatimKinds.sort()).toEqual(['@layer', '@media', '@supports']);

      // A stylesheet with nothing unsupported reports nothing, so this cannot
      // pass vacuously.
      expect(convertCSSToStyleInfo('.a { color: red; }').verbatimKinds)
        .toEqual([]);
    });

    /**
     * Ordering is the subtle half of mixing the two channels.
     * `loadStyleFromJSON` drains the entire `content` channel before it looks at
     * `rules`, so carrying preserved at-rules on `content` and tokenized rules
     * on `rules` would hoist every at-rule to the front of the stylesheet. For
     * two declarations of equal specificity that inverts which one wins, which
     * is a silent rendering change - so the converter keeps one ordered list.
     */
    test('keeps a preserved at-rule at its source position', () => {
      const css = engineCSS(
        '.a { color: red; }'
          + ' @media (min-width: 600px) { .a { color: blue; } }'
          + ' .b { color: green; }',
      );

      const first = css.indexOf('.a:not(');
      const media = css.indexOf('@media');
      const last = css.indexOf('.b:not(');

      expect(first).toBeGreaterThanOrEqual(0);
      expect(media).toBeGreaterThanOrEqual(0);
      expect(last).toBeGreaterThanOrEqual(0);
      // Document order: `.a`, then the `@media` block, then `.b`.
      expect(first).toBeLessThan(media);
      expect(media).toBeLessThan(last);
    });

    test('CSS inside a preserved at-rule is not tokenized', () => {
      // The documented, narrower limitation that replaces the old one. Outside
      // the block `rem` is rewritten; inside it the text is passed through, so
      // the author's unit survives untouched.
      const css = engineCSS(
        '.a { padding: 1rem; }'
          + ' @media (min-width: 600px) { .b { padding: 2rem; } }',
        { rem: true },
      );
      expect(css).toContain('padding:calc(1 * var(--rem-unit));');
      // Inside the block the author's own unit survives untouched.
      expect(css).toMatch(/@media[^{]*\{[^}]*padding:\s*2rem/);
    });
  });

  describe('rule kinds the binary format does represent', () => {
    test('tokenizes `@keyframes`', () => {
      const css = engineCSS(
        '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }',
      );
      expect(css).toContain('@keyframes fade');
      expect(css).toContain('opacity:0;');
      expect(css).toContain('opacity:1;');
    });

    test('tokenizes `@font-face`', () => {
      const css = engineCSS(
        '@font-face { font-family: "Card"; src: url("card.woff2"); }',
      );
      expect(css).toContain('@font-face');
      expect(css).toContain('Card');
    });
  });

  describe('selector shapes', () => {
    test('carries combinators, pseudo classes and attribute selectors', () => {
      // Selectors are rebuilt section by section, so a shape that the rebuild
      // mishandles would surface as a mangled or missing selector rather than as
      // an error. The engine emits a combinator surrounded by spaces, and a
      // descendant combinator as a run of spaces.
      const css = engineCSS(
        '.a > .b { color: red; }'
          + ' .c .d { color: red; }'
          + ' .e:hover { color: red; }'
          + ' [data-x="y"] { color: red; }'
          + ' .f.g { color: red; }',
      );
      expect(css).toContain('.a > .b');
      expect(css).toMatch(/\.c\s+\.d/);
      expect(css).toContain('.e:hover');
      expect(css).toContain('[data-x="y"]');
      // A compound selector has no separator at all, which is what distinguishes
      // it from the descendant case above.
      expect(css).toContain('.f.g');
    });

    test('carries a sibling combinator', () => {
      expect(engineCSS('.e + .f { color: red; }')).toContain('.e + .f');
      expect(engineCSS('.g ~ .h { color: red; }')).toContain('.g ~ .h');
    });

    test('keeps every selector of a selector list', () => {
      const css = engineCSS('.a, .b { color: red; }');
      expect(css).toContain('.a');
      expect(css).toContain('.b');
    });
  });

  test('leaves an empty stylesheet empty', () => {
    expect(convertCSSToStyleInfo('').ordered).toEqual([]);
    // Comments carry no rules either, and must not produce a stray entry.
    expect(convertCSSToStyleInfo('/* nothing */').ordered).toEqual([]);
  });
});
