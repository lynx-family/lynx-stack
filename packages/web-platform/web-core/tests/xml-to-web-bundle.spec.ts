// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * XML markup document -> `.web.bundle` bytes -> back through the decoder.
 *
 * The claim under test is that a hand-written card can be *built*, rather than
 * needing a load-time bypass: the bytes must be an ordinary modern bundle, with
 * the same header, the same sections and the same rkyv-encoded `StyleInfo` a
 * ReactLynx build produces. So the assertions do not inspect intermediate
 * structures - they walk the produced bytes exactly as
 * `decodeWorker/decode.worker.ts` does, and hand the `StyleInfo` section to the
 * same `decode_style_info` the browser calls. If the encoder produced something
 * the decoder could not read, `from_bytes_unchecked` on the other side would not
 * return this CSS.
 */

import './jsdom.js';
import { describe, expect, test } from '@rstest/core';
import * as CSS from '@lynx-js/css-serializer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decode_style_info,
  get_font_face_content,
  get_style_content,
} from '../binary/encode/encode.js';
import { TemplateSectionLabel } from '../ts/constants.js';
import {
  diagnoseDiscardedAtRules,
  encodeLynxXML,
  xmlToTasmJSON,
} from '../ts/encode/xmlToTasmJSON.js';

const MagicHeader0 = 0x41524453;
const MagicHeader1 = 0x464F5257;

/**
 * Walks a bundle the way the decode worker does: magic, version, then
 * label/length framed sections until EOF.
 *
 * Deliberately not sharing code with the encoder - a shared helper could agree
 * with a wrong encoder.
 */
function readBundle(buffer: Uint8Array) {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  expect(view.getUint32(0, true)).toBe(MagicHeader0);
  expect(view.getUint32(4, true)).toBe(MagicHeader1);
  const version = view.getUint32(8, true);
  // The decoder rejects anything above 1.
  expect(version).toBeLessThanOrEqual(1);

  const sections = new Map<number, Uint8Array>();
  let offset = 12;
  while (offset < buffer.byteLength) {
    const label = view.getUint32(offset, true);
    offset += 4;
    const length = view.getUint32(offset, true);
    offset += 4;
    expect(offset + length).toBeLessThanOrEqual(buffer.byteLength);
    // Copied, not a view. `StreamReader.read` copies too (via `slice`), and the
    // decoder relies on it: `decodeJSONMap` builds a `Uint16Array` over
    // `byteOffset`, which throws for an odd offset - and a section can start at
    // one, since `LepusCode` is UTF-8 and may have odd length. Taking a view
    // here would fail on a bundle the browser reads fine.
    sections.set(label, buffer.slice(offset, offset + length));
    offset += length;
  }
  // Framing consumed the buffer exactly, with no trailing slack.
  expect(offset).toBe(buffer.byteLength);
  return { version, sections };
}

/**
 * `Configurations` and `CustomSections` are UTF-16 code units of a JSON string,
 * see `encodeAsJSON`.
 */
function readJSONSection(bytes: Uint8Array): Record<string, unknown> {
  const units = new Uint16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2,
  );
  return JSON.parse(String.fromCharCode(...units));
}

/**
 * `Manifest` and `LepusCode` are a count followed by length-prefixed UTF-8
 * key/value pairs, see `encodeStringMap`.
 */
function readStringMap(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const count = view.getUint32(0, true);
  let offset = 4;
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const keyLength = view.getUint32(offset, true);
    offset += 4;
    const key = decoder.decode(bytes.subarray(offset, offset + keyLength));
    offset += keyLength;
    const valueLength = view.getUint32(offset, true);
    offset += 4;
    const value = decoder.decode(bytes.subarray(offset, offset + valueLength));
    offset += valueLength;
    out[key] = value;
  }
  expect(offset).toBe(bytes.byteLength);
  return out;
}

/**
 * Runs the `StyleInfo` section through the decoder the browser uses, and returns
 * the stylesheet it yields.
 */
function decodeStyle(
  section: Uint8Array,
  config: Record<string, unknown>,
  {
    transformVW = false,
    transformVH = false,
    transformREM = false,
  } = {},
) {
  const decoded = decode_style_info(
    section,
    config['isLazy'] === 'true' ? 'http://example.com/card' : undefined,
    config['enableCSSSelector'] === 'true',
    transformVW,
    transformVH,
    transformREM,
  );
  return {
    css: get_style_content(decoded),
    fontFace: get_font_face_content(decoded),
  };
}

function xml(
  { style, background }: { style?: string; background?: string } = {},
) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE lynx>',
    '<lynx version="5.4.2">',
    style === undefined ? '' : `<style><![CDATA[${style}]]></style>`,
    '<script main-thread="true"><![CDATA[globalThis.__mts = 1;]]></script>',
    background === undefined
      ? ''
      : `<script background="true"><![CDATA[${background}]]></script>`,
    '</lynx>',
  ].filter(Boolean).join('\n');
}

function build(source: string) {
  const result = encodeLynxXML(source);
  if (!result.success) {
    throw new Error(`expected a bundle, got: ${result.message}`);
  }
  return result;
}

describe('XML markup document to web bundle', () => {
  test('produces a bundle the decoder frames and reads', () => {
    const { buffer } = build(
      xml({
        style: '.a{color:red}',
        background: 'globalThis.__bts = 1;',
      }),
    );
    const { version, sections } = readBundle(buffer);
    expect(version).toBe(1);

    // Every section a markup card can fill, and only those: the format carries
    // no custom sections and no element templates.
    expect([...sections.keys()].sort((a, b) => a - b)).toStrictEqual([
      TemplateSectionLabel.Manifest,
      TemplateSectionLabel.StyleInfo,
      TemplateSectionLabel.LepusCode,
      TemplateSectionLabel.CustomSections,
      TemplateSectionLabel.Configurations,
    ].sort((a, b) => a - b));

    const config = readJSONSection(
      sections.get(TemplateSectionLabel.Configurations)!,
    );
    expect(config).toMatchObject({
      cardType: 'react',
      isLazy: 'false',
      enableCSSSelector: 'true',
      enableRemoveCSSScope: 'true',
      defaultDisplayLinear: 'false',
      defaultOverflowVisible: 'false',
      enableJSDataProcessor: 'false',
    });

    // The main-thread script rides the `root` lepus chunk.
    expect(readStringMap(sections.get(TemplateSectionLabel.LepusCode)!))
      .toStrictEqual({ root: 'globalThis.__mts = 1;' });
    // The background script rides the manifest, verbatim.
    expect(readStringMap(sections.get(TemplateSectionLabel.Manifest)!))
      .toStrictEqual({ '/app-service.js': 'globalThis.__bts = 1;' });

    const { css } = decodeStyle(
      sections.get(TemplateSectionLabel.StyleInfo)!,
      config,
    );
    expect(css).toContain('color:red');
    // The stylesheet has to land under css id 0, the card's own sheet. Any other
    // id makes the decoder scope every selector with `:where([l-css-id="N"])`,
    // which never matches the card's elements - the rules would decode fine and
    // still apply to nothing.
    expect(css).not.toContain('l-css-id');
    expect(css).toContain('.a:not([l-e-name])');
  });

  test('omits the sections an XML document cannot fill', () => {
    // No `<style>` and no background script: the encoder must still frame a
    // readable bundle rather than emit an empty or malformed section.
    const { buffer } = build(xml());
    const { sections } = readBundle(buffer);
    expect(readStringMap(sections.get(TemplateSectionLabel.Manifest)!))
      .toStrictEqual({});
    expect(
      readJSONSection(sections.get(TemplateSectionLabel.CustomSections)!),
    ).toStrictEqual({});
    expect(sections.has(TemplateSectionLabel.ElementTemplates)).toBe(false);
  });

  /**
   * Proves the framing assertions above are load-bearing.
   *
   * `readBundle` is the whole basis for claiming the bytes are a valid bundle, so
   * if it accepted a corrupted one the round-trip tests would be vacuous. These
   * corrupt a known-good bundle in the three ways the decoder itself rejects.
   */
  describe('the bundle reader rejects what the decoder rejects', () => {
    function goodBundle() {
      return build(xml({ style: '.a{color:red}' })).buffer;
    }

    test('rejects a wrong magic header', () => {
      const buffer = goodBundle();
      // The decoder throws `Invalid Magic Header` on exactly this.
      buffer[0] = buffer[0]! ^ 0xff;
      expect(() => readBundle(buffer)).toThrow();
    });

    test('rejects a version the decoder would refuse', () => {
      const buffer = goodBundle();
      new DataView(buffer.buffer, buffer.byteOffset).setUint32(8, 2, true);
      expect(() => readBundle(buffer)).toThrow();
    });

    test('rejects a truncated bundle', () => {
      const buffer = goodBundle();
      // Losing the tail makes the last section's declared length overrun, which
      // is the `Unexpected EOF reading section content` case.
      expect(() => readBundle(buffer.subarray(0, buffer.byteLength - 4)))
        .toThrow();
    });

    test('rejects a bundle with a lying section length', () => {
      const buffer = goodBundle();
      const view = new DataView(buffer.buffer, buffer.byteOffset);
      // The first section's length, at magic(8) + version(4) + label(4).
      view.setUint32(16, view.getUint32(16, true) + 1, true);
      expect(() => readBundle(buffer)).toThrow();
    });
  });

  test('reports a malformed document instead of throwing', () => {
    const result = encodeLynxXML('<lynx>no closing tag');
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('unreachable');
    }
    expect(result.message).toMatch(/invalid TemplateBundle XML at offset \d+:/);
  });

  describe('the style pipeline the bundle path unlocks', () => {
    test('translates Lynx layout properties through the real decoder', () => {
      // `display: linear` is not web CSS - a browser discards the value and
      // falls back to `block`. Because the bundle carries tokenized rules, the
      // Rust style transformer runs and turns it into custom properties plus a
      // real `display`.
      const { buffer } = build(
        xml({ style: '.row{display:linear;linear-direction:row}' }),
      );
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const { css } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
      );
      expect(css).toContain('--lynx-display:linear');
      expect(css).toContain('display:flex');
      expect(css).toContain('--lynx-linear-orientation:horizontal');
    });

    test('rewrites rem, vw and vh when the host asks for it', () => {
      const { buffer } = build(
        xml({ style: '.a{padding:1rem;width:50vw;height:2vh}' }),
      );
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const section = sections.get(TemplateSectionLabel.StyleInfo)!;

      const on = decodeStyle(section, config, {
        transformREM: true,
        transformVW: true,
        transformVH: true,
      });
      expect(on.css).toContain('padding:calc(1 * var(--rem-unit))');
      expect(on.css).toContain('width:calc(50 * var(--vw-unit))');
      expect(on.css).toContain('height:calc(2 * var(--vh-unit))');

      // Same bytes, transforms off: the units survive. Proves the rewrite is the
      // decoder's doing and is driven by the host, not baked into the bundle.
      const off = decodeStyle(section, config);
      expect(off.css).toContain('padding:1rem');
      expect(off.css).toContain('width:50vw');
    });

    test('rewrites :root, which never matches inside a shadow root', () => {
      const { buffer } = build(
        xml({ style: ':root{--accent:#f00;font-size:14px}' }),
      );
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const { css } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
      );
      expect(css).toContain('[part="page"]');
      expect(css).not.toContain(':root');
    });

    test('restores var() rather than shipping the interchange placeholder', () => {
      // `css-serializer` rewrites `var()` into `{{--name}}` as its own wire
      // format; unrestored it would reach the engine as literal text.
      const { buffer } = build(
        xml({
          style:
            '.a{background-color:var(--accent);border:var(--w, 2px) solid red}',
        }),
      );
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const { css } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
      );
      expect(css).toContain('var(--accent)');
      expect(css).toContain('var(--w, 2px)');
      expect(css).not.toContain('{{');
    });

    test('carries @keyframes and @font-face, the two group kinds Lynx has', () => {
      const { buffer, discarded } = build(
        xml({
          style: '@keyframes spin{from{opacity:0}to{opacity:1}}'
            + '@font-face{font-family:CardFont;src:url(a.woff2)}',
        }),
      );
      expect(discarded).toStrictEqual([]);
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const { css, fontFace } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
      );
      expect(css).toContain('@keyframes spin');
      expect(css).toContain('opacity:1');
      expect(fontFace).toContain('CardFont');
    });
  });

  /**
   * Specified behaviour, not a defect.
   *
   * Lynx's style format has three rule kinds and no conditional group, so
   * `@media` / `@supports` / `@layer` are not Lynx features on any platform, and
   * the CSS parser has no case for the rest. Carrying them on web would give a
   * markup card a capability a ReactLynx card does not have, so they are dropped
   * - and reported, so the author is not left guessing.
   */
  describe('at-rules Lynx does not support are dropped and reported', () => {
    const cases: Record<
      string,
      { css: string; reason: 'unrepresentable' | 'unsupported'; gone: string }
    > = {
      '@media': {
        css: '@media (max-width:600px){.i{color:navy}}',
        reason: 'unrepresentable',
        gone: 'navy',
      },
      '@supports': {
        css: '@supports (display:grid){.i{color:teal}}',
        reason: 'unrepresentable',
        gone: 'teal',
      },
      '@layer': {
        css: '@layer base{.i{color:olive}}',
        reason: 'unrepresentable',
        gone: 'olive',
      },
      '@container': {
        css: '@container (min-width:1px){.i{color:maroon}}',
        reason: 'unsupported',
        gone: 'maroon',
      },
      '@property': {
        css: '@property --x{syntax:"<length>";inherits:false}',
        reason: 'unsupported',
        gone: 'syntax',
      },
      '@scope': {
        css: '@scope (.a){.i{color:peru}}',
        reason: 'unsupported',
        gone: 'peru',
      },
      '@page': {
        css: '@page{margin:1cm}',
        reason: 'unsupported',
        gone: '1cm',
      },
      '@charset': {
        css: '@charset "utf-8";',
        reason: 'unsupported',
        gone: 'utf-8',
      },
      '@namespace': {
        css: '@namespace svg url(http://www.w3.org/2000/svg);',
        reason: 'unsupported',
        gone: 'w3.org',
      },
      '@starting-style': {
        css: '@starting-style{.i{opacity:0}}',
        reason: 'unsupported',
        gone: 'opacity',
      },
      'an at-rule newer than the parser': {
        css: '@future-thing x{.i{color:plum}}',
        reason: 'unsupported',
        gone: 'plum',
      },
    };

    for (const [name, { css: atRule, reason, gone }] of Object.entries(cases)) {
      test(`drops ${name} and says so`, () => {
        const source = xml({
          style: `.before{color:red}${atRule}.after{color:black}`,
        });
        const { buffer, discarded } = build(source);

        // Reported once, with the right reason.
        expect(discarded).toStrictEqual([{
          name: name.startsWith('@') ? name : '@future-thing',
          reason,
        }]);

        const { sections } = readBundle(buffer);
        const config = readJSONSection(
          sections.get(TemplateSectionLabel.Configurations)!,
        );
        const { css } = decodeStyle(
          sections.get(TemplateSectionLabel.StyleInfo)!,
          config,
        );
        // The rules around it are untouched...
        expect(css).toContain('color:red');
        expect(css).toContain('color:black');
        // ... and nothing from inside it was promoted to top level.
        expect(css).not.toContain(gone);
        expect(css).not.toContain('.i');
      });
    }

    test('drops a URL @import instead of failing the build', () => {
      // `encodeCSS` throws on a non-numeric css id, so an unfiltered
      // `@import url(...)` would abort bundle production. It is not a Lynx
      // feature for this format - a markup card owns one stylesheet and has
      // nothing to link to - so it is dropped like the rest.
      const source = xml({
        style: '@import url("theme.css");\n.a{color:red}',
      });
      expect(() => build(source)).not.toThrow();
      const { buffer, discarded } = build(source);
      // Reported, so the author is not left wondering where the import went.
      expect(discarded).toStrictEqual([
        { name: '@import', reason: 'unresolvable' },
      ]);
      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      const { css } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
      );
      expect(css).toContain('color:red');
      expect(css).not.toContain('theme.css');
    });

    test('keeps a numeric @import, which a build step does emit', () => {
      // `@import` itself is representable - the tokenized channel links one
      // numeric css id to another. Only the URL form is not, so the numeric form
      // must survive untouched.
      const { discarded } = build(
        xml({ style: '@import url("1");\n.a{color:red}' }),
      );
      expect(discarded).toStrictEqual([]);
    });

    test('reports a hollow group, which looks preserved but is not', () => {
      // The nastiest shape: `css-serializer` produces a `MediaRule` with zero
      // children and an empty `errors` array, so the group appears to have been
      // understood while its contents are already gone.
      const style = '@media screen{@font-face{font-family:CardFont}}';
      const parsed = CSS.parse(style);
      expect(parsed.errors).toStrictEqual([]);
      expect(parsed.root).toStrictEqual([{
        type: 'MediaRule',
        prelude: { value: 'screen', loc: { line: 1, column: 14 } },
        rules: [],
      }]);

      const { discarded } = build(xml({ style }));
      // Both losses are named, so the report matches what actually happened.
      expect(discarded).toStrictEqual([
        { name: '@media', reason: 'unrepresentable' },
      ]);
    });

    test('names every distinct at-rule once, at any depth', () => {
      const found = diagnoseDiscardedAtRules(
        '@media screen{.a{color:red}}'
          + '@media print{.b{color:red}}'
          + '@supports (display:grid){@container (min-width:1px){.c{color:red}}}'
          + '@keyframes k{from{opacity:0}}',
      );
      expect(found).toStrictEqual([
        { name: '@media', reason: 'unrepresentable' },
        { name: '@supports', reason: 'unrepresentable' },
        // Nested inside the group, and still reported.
        { name: '@container', reason: 'unsupported' },
      ]);
    });
  });

  describe('the real world fixture', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        'fixtures',
        'markup-card.xml',
      ),
      'utf-8',
    );

    test('builds into a bundle with every section populated', () => {
      const { buffer, discarded } = build(source);
      // A hand-authored card written for Lynx uses nothing unsupported.
      expect(discarded).toStrictEqual([]);

      const { sections } = readBundle(buffer);
      const config = readJSONSection(
        sections.get(TemplateSectionLabel.Configurations)!,
      );
      expect(readStringMap(sections.get(TemplateSectionLabel.LepusCode)!).root)
        .toContain('__RenderPage');
      expect(
        readStringMap(sections.get(TemplateSectionLabel.Manifest)!)[
          '/app-service.js'
        ],
      ).toBeTypeOf('string');

      const { css } = decodeStyle(
        sections.get(TemplateSectionLabel.StyleInfo)!,
        config,
        { transformREM: true, transformVW: true, transformVH: true },
      );
      // The card's own custom property survives, and its rem paddings are
      // rewritten against the lynx-view box.
      expect(css).toContain('--accent');
      expect(css).toContain('var(--rem-unit)');
      // This fixture scopes to `.page` rather than `:root` (see its own comment),
      // so the selector rewrite to check for is the css-scope suffix.
      expect(css).toContain('.page:not([l-e-name])');
    });

    test('is deterministic', () => {
      // A build artifact has to be reproducible, or caching downstream breaks.
      const a = build(source).buffer;
      const b = build(source).buffer;
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    });
  });

  test('keeps the JSON encode path reachable and unchanged in shape', () => {
    // `xmlToTasmJSON` must produce the very shape `encode` already accepts, with
    // no markup-specific field, or the two paths have silently diverged.
    const result = xmlToTasmJSON(xml({ style: '.a{color:red}' }));
    if (!result.success) {
      throw new Error('unreachable');
    }
    expect(Object.keys(result.tasmJSON).sort()).toStrictEqual([
      'appType',
      'cardType',
      'customSections',
      'elementTemplates',
      'lepusCode',
      'manifest',
      'pageConfig',
      'styleInfo',
    ]);
  });
});
