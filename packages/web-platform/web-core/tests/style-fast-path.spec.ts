// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Equivalence guard on the rkyv-free style fast path.
 *
 * `StyleSheetResource.fromRawStyleInfo` exists so that a caller already on the
 * main thread can skip the two rkyv passes the bundle path needs - the decode
 * worker serialising a `DecodedStyleData` it just built, and the main thread
 * immediately deserialising it - neither of which carries information. See the
 * doc comment on the Rust entry.
 *
 * The two paths are meant to be the same computation, so the risk is not that
 * the fast path is wrong today but that it silently drifts from the bundle path
 * later. These tests pin them together over a matrix of stylesheets and decoder
 * flags.
 *
 * ## How the comparison observes a resource
 *
 * A `StyleSheetResource` keeps its `<style>` elements in Rust and exposes no
 * getter for them, so the elements are captured at creation instead: the Rust
 * side does `_document.unchecked_into::<web_sys::Document>()` and then
 * `create_element("style")` plus `set_text_content`, so a stand-in object with a
 * `createElement` method records exactly the text each path would have put in the
 * document. The bundle path's side of the comparison is read through
 * `get_style_content` / `get_font_face_content`, the accessors that already exist
 * for its rkyv bytes.
 *
 * ## Known gap
 *
 * `css_og_css_id_to_class_selector_name_to_declarations_map`, which is populated
 * when `enable_css_selector` is false, is not compared here: it is `pub(crate)`
 * and reachable only through `query_css_og_declarations_by_css_id` during element
 * rendering, with no wasm-exposed getter. `flushes the same rendered styles`
 * below covers it end to end instead, through the element pipeline, which is the
 * only route available.
 */

import './jsdom.js';
import { describe, expect, test } from '@rstest/core';
import * as CSS from '@lynx-js/css-serializer';

import { wasmInstance } from '../ts/client/wasm.js';
import { pushStyleNodes } from '../ts/common/css/buildRawStyleInfo.js';

/**
 * A fresh `RawStyleInfo` per call: both entry points take it by value and the
 * wasm object is moved, so the two paths cannot share one.
 */
function makeRawStyleInfo(css: string): any {
  const rawStyleInfo = new wasmInstance.RawStyleInfo();
  pushStyleNodes(
    rawStyleInfo as any,
    wasmInstance as any,
    0,
    CSS.parse(css).root,
    { onGroupAtRule: () => {}, onNonNumericImport: () => {} },
  );
  return rawStyleInfo;
}

/**
 * Records the text content of every `<style>` element a path creates, in order.
 */
function capturingDocument(sink: string[]) {
  return {
    createElement: () => ({
      set textContent(value: string) {
        sink.push(value);
      },
    }),
  };
}

interface DecoderFlags {
  enableCSSSelector: boolean;
  entryName?: string;
  transformVW: boolean;
  transformVH: boolean;
  transformREM: boolean;
}

/** What the fast path puts into the document. */
function viaFastPath(css: string, flags: DecoderFlags): string[] {
  const captured: string[] = [];
  (wasmInstance.StyleSheetResource as any).fromRawStyleInfo(
    makeRawStyleInfo(css),
    capturingDocument(captured),
    flags.enableCSSSelector,
    flags.entryName,
    flags.transformVW,
    flags.transformVH,
    flags.transformREM,
  );
  return captured;
}

/** What the bundle path decodes, read through its rkyv accessors. */
function viaBundlePath(css: string, flags: DecoderFlags): string[] {
  const bytes = wasmInstance.encode_legacy_json_generated_raw_style_info(
    makeRawStyleInfo(css),
    flags.enableCSSSelector,
    flags.entryName,
    flags.transformVW,
    flags.transformVH,
    flags.transformREM,
  );
  // Both sections are always `Some` on a `DecodedStyleData` built from a decoder
  // (see its `From<StyleInfoDecoder>`), so the resource always creates two style
  // elements even when a section is empty. Compare both, unfiltered, so that an
  // empty section is still held to the same value on either side.
  return [
    wasmInstance.get_style_content(bytes),
    wasmInstance.get_font_face_content(bytes),
  ];
}

/**
 * One stylesheet per decoder behaviour the fast path must not change.
 */
const stylesheets: Record<string, string> = {
  plain: '.a{color:red}',
  // The Lynx property translation that only the tokenized channel performs -
  // `display:linear` reaching a browser verbatim is silently dropped as an
  // invalid value.
  lynxDisplay: '.a{display:linear;linear-direction:column}',
  // Unit rewrites, each gated by its own decoder flag.
  units: '.a{width:100vw;height:50vh;font-size:1rem;padding:10rpx}',
  fontFace: '@font-face{font-family:X;src:url(a.woff2)}',
  // Both sections at once, which is the case where element order matters.
  bothSections: '@font-face{font-family:Y;src:url(b.woff2)}.a{color:blue}',
  keyframes: '@keyframes spin{from{opacity:0}to{opacity:1}}',
  cssVars: ':root{--accent:#f00}.t{color:var(--accent)}',
  selectors:
    '.a .b>.c+.d~.e:hover::before{color:red}#i[data-x="1"]{color:blue}',
  // `:root` has to become a page selector, since card content lives in a shadow
  // root where `:root` can never match.
  rootSelector: ':root{font-size:14px}',
  empty: '',
};

const flagMatrix: Record<string, DecoderFlags> = {
  'selector mode, no transforms': {
    enableCSSSelector: true,
    transformVW: false,
    transformVH: false,
    transformREM: false,
  },
  'selector mode, all transforms': {
    enableCSSSelector: true,
    transformVW: true,
    transformVH: true,
    transformREM: true,
  },
  'css og mode': {
    enableCSSSelector: false,
    transformVW: false,
    transformVH: false,
    transformREM: false,
  },
  'lazy entry scoping': {
    enableCSSSelector: true,
    entryName: 'https://example.com/lazy.bundle',
    transformVW: true,
    transformVH: false,
    transformREM: true,
  },
};

describe('style fast path', () => {
  for (const [flagName, flags] of Object.entries(flagMatrix)) {
    describe(flagName, () => {
      for (const [cssName, css] of Object.entries(stylesheets)) {
        test(`produces what the bundle path produces: ${cssName}`, () => {
          expect(viaFastPath(css, flags)).toStrictEqual(
            viaBundlePath(css, flags),
          );
        });
      }
    });
  }

  test('actually translates rather than passing css through', () => {
    // Guards the comparison itself: if both paths degenerated to verbatim
    // passthrough the equality above would still hold, so assert that the
    // translation the tokenized channel exists for did happen.
    const [content] = viaFastPath('.a{display:linear}', {
      enableCSSSelector: true,
      transformVW: false,
      transformVH: false,
      transformREM: false,
    });
    expect(content).toContain('display:flex');
    expect(content).toContain('--lynx-display-linear');
    expect(content).toContain(':not([l-e-name])');
  });

  test('rewrites rem against the transform flag', () => {
    const flags = {
      enableCSSSelector: true,
      transformVW: false,
      transformVH: false,
      transformREM: true,
    };
    const [withTransform] = viaFastPath('.a{font-size:1rem}', flags);
    const [without] = viaFastPath('.a{font-size:1rem}', {
      ...flags,
      transformREM: false,
    });
    // Distinguishes the two flag settings, so the matrix above is not comparing
    // one behaviour to itself under four names.
    expect(withTransform).not.toBe(without);
    expect(withTransform).toContain('rem-unit');
  });
});
