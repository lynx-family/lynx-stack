// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A markup (buildless Lynx XML) card is compiled into a bundle in the browser.
 *
 * ## What is worth asserting, and what is not
 *
 * A markup card used to be converted into an artifact object and decoded down a
 * path of its own, so the property that made it sound was that its output agreed
 * with the bundle path's. That is no longer a property: the card is now compiled
 * by `encodeLynxXML` - the same function a build runs - into bundle bytes, which
 * are handed back to `handleStream`. There is one path, so "the two paths agree"
 * is not something a test can fail and has been deleted rather than kept as a
 * tautology.
 *
 * What is left to establish is that the bytes really are a bundle, and that is
 * asserted here against an *independent* reader: `decodeTemplate` in
 * `ts/server/decode.ts`, the SSR decoder, which walks the header, the version and
 * every section length with its own code. If it accepts what the browser
 * compiled, the bytes are a `.web.bundle` by a second opinion rather than by
 * construction.
 *
 * The end-to-end half - that loading the XML through the worker is
 * indistinguishable from loading those compiled bytes - is in
 * `template-manager.spec.ts`, which has the worker harness.
 */

import { describe, expect, rstest, test } from '@rstest/core';

import { encodeLynxXML } from '../ts/encode/index.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../ts/constants.js';

// The SSR decoder's own style step needs the server wasm, which is beside the
// point here: what is being checked is that it can walk the container. Identity
// keeps the section's bytes visible for assertion, exactly as `decode.spec.ts`
// does it.
rstest.mock('../ts/server/wasm.js', () => ({
  decode_style_info: rstest.fn((buffer: Uint8Array) => buffer),
}));

const { decodeTemplate } = await import('../ts/server/decode.js');

const MAIN_THREAD_SCRIPT = 'globalThis.__mts = 1;';
const BACKGROUND_SCRIPT = 'globalThis.__bts = 2;';

function cardOf(style: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<lynx version="5.4.2">',
    `<style><![CDATA[${style}]]></style>`,
    `<script main-thread="true"><![CDATA[${MAIN_THREAD_SCRIPT}]]></script>`,
    `<script background="true"><![CDATA[${BACKGROUND_SCRIPT}]]></script>`,
    '</lynx>',
  ].join('\n');
}

function compile(source: string): Uint8Array {
  const result = encodeLynxXML(source);
  if (!result.success) {
    throw new Error(result.message);
  }
  return result.buffer;
}

/** The section labels the bytes carry, in the order they appear. */
function sectionOrder(buffer: Uint8Array): string[] {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const names = Object.fromEntries(
    Object.entries(TemplateSectionLabel).map(([name, value]) => [value, name]),
  ) as Record<number, string>;
  const found: string[] = [];
  let offset = 12; // magic header (8) + version (4)
  while (offset + 8 <= buffer.length) {
    const label = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    found.push(names[label] ?? `unknown(${label})`);
    offset += 8 + length;
  }
  // A trailing partial section would mean the lengths do not tile the buffer.
  expect(offset).toBe(buffer.length);
  return found;
}

describe('a markup card compiles to bundle bytes', () => {
  const buffer = compile(cardOf('.a{color:red;display:linear}'));

  test('begins with the bundle magic header', () => {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    expect(view.getUint32(0, true)).toBe(MagicHeader0);
    expect(view.getUint32(4, true)).toBe(MagicHeader1);
    // Spelled out, because the header is what every other reader dispatches on.
    expect(new TextDecoder().decode(buffer.subarray(0, 8))).toBe('SDRAWROF');
    expect(view.getUint32(8, true)).toBe(1);
  });

  /**
   * The magic header is also what makes `handleMarkup`'s recursion terminate: it
   * hands these bytes back to `handleStream`, which takes the binary branch on
   * them and so cannot reach `handleMarkup` a second time. Pinned because the
   * argument is in a comment there and this is the fact it rests on.
   */
  test('does not look like either of the other two artifact shapes', () => {
    expect(buffer[0]).not.toBe(0x7b); // '{', the JSON branch
    expect(buffer[0]).not.toBe(0x3c); // '<', what the markup fallback needs
  });

  test('carries the sections the encoder emits, in its order', () => {
    expect(sectionOrder(buffer)).toStrictEqual([
      'Configurations',
      'LepusCode',
      'CustomSections',
      'StyleInfo',
      'Manifest',
    ]);
  });

  /**
   * The second opinion. `decodeTemplate` shares no container-parsing code with
   * the worker's `handleStream`, so its accepting these bytes is a statement
   * about the bytes rather than about one reader's tolerance.
   */
  describe('and the SSR decoder reads them as an ordinary bundle', () => {
    const decoded = decodeTemplate(buffer, false, false, false);

    test('recovers the config the engine hard-codes for a markup card', () => {
      expect(decoded.config).toMatchObject({
        cardType: 'react',
        isLazy: 'false',
        enableCSSSelector: 'true',
        enableRemoveCSSScope: 'true',
        defaultDisplayLinear: 'false',
      });
    });

    test('recovers the main thread script', () => {
      expect(Object.keys(decoded.lepusCode)).toStrictEqual(['root']);
      expect(new TextDecoder().decode(decoded.lepusCode['root']!)).toBe(
        MAIN_THREAD_SCRIPT,
      );
    });

    test('recovers a non-empty StyleInfo section', () => {
      expect(decoded.styleInfo).toBeDefined();
      expect(decoded.styleInfo!.length).toBeGreaterThan(0);
    });
  });

  /**
   * Not covered by the container assertions: they would hold just as well if the
   * stylesheet had been dropped on the way through.
   *
   * The `StyleInfo` section is rkyv-encoded and tokenised, so a declaration is
   * not present as the text `display:linear` and a value like `rgb(1,2,3)` is
   * stored as seven separate tokens. Single-token strings are therefore what can
   * be asserted on: the selector's own name and two ident values. `linear` in
   * particular is a Lynx-only `display` value, so finding it shows the author's
   * CSS reached the bytes rather than some browser-legal default.
   */
  test('carries the card\'s own declarations, not an empty stylesheet', () => {
    const withStyle = compile(
      cardOf('.lynxMarkupProbe{display:linear;color:cornflowerblue}'),
    );
    const withoutStyle = compile(cardOf(''));
    expect(withStyle.length).toBeGreaterThan(withoutStyle.length);

    const decode = (bytes: Uint8Array) =>
      new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    for (const token of ['lynxMarkupProbe', 'cornflowerblue', 'linear']) {
      expect(decode(withStyle)).toContain(token);
      // Absent without the stylesheet, so the assertion above is not matching
      // something the container carries regardless.
      expect(decode(withoutStyle)).not.toContain(token);
    }
  });

  test('reports a document it cannot parse instead of throwing', () => {
    const result = encodeLynxXML('<lynx version="1">never closed');
    expect(result.success).toBe(false);
    expect((result as { message: string }).message).toMatch(
      /invalid TemplateBundle XML at offset \d+:/,
    );
  });
});
