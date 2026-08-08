// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The markup load path that runs on the main thread.
 *
 * The load-bearing property is not that this path works but that it agrees with
 * the bundle path: the same XML document must render the same whether it was
 * built into a `.web.bundle` by `encodeLynxXML` or loaded directly here. So most
 * of these tests build both and compare, rather than asserting against literals
 * that could drift with the encoder.
 */

import './jsdom.js';
import { beforeEach, describe, expect, test } from '@rstest/core';

import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../ts/constants.js';
import { encodeLynxXML } from '../ts/encode/index.js';
import { wasmInstance } from '../ts/client/wasm.js';
import {
  buildMarkupTemplate,
  resetDiscardedAtRuleReports,
} from '../ts/client/mainthread/markup/buildMarkupTemplate.js';

const cardURL = 'http://example.com/card.xml';

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

/** Reads the sections out of a bundle, so the two paths can be compared. */
function readSections(buffer: Uint8Array): Map<number, Uint8Array> {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  expect(view.getUint32(0, true)).toBe(MagicHeader0);
  expect(view.getUint32(4, true)).toBe(MagicHeader1);
  let offset = 12;
  const sections = new Map<number, Uint8Array>();
  while (offset < buffer.byteLength) {
    const label = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    offset += 8;
    sections.set(label, buffer.subarray(offset, offset + length));
    offset += length;
  }
  return sections;
}

function decodeUTF16JSON<T>(bytes: Uint8Array): T {
  const units = new Uint16Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 2,
  );
  return JSON.parse(String.fromCharCode(...units));
}

/** The config and stylesheet the bundle path yields for the same document. */
function viaBundle(source: string, transforms = {
  transformVW: false,
  transformVH: false,
  transformREM: false,
}) {
  const built = encodeLynxXML(source);
  if (!built.success) {
    throw new Error(`expected a bundle, got: ${built.message}`);
  }
  const sections = readSections(built.buffer);
  const config = decodeUTF16JSON<Record<string, string>>(
    sections.get(TemplateSectionLabel.Configurations)!,
  );
  const styleSection = sections.get(TemplateSectionLabel.StyleInfo)!;
  const decoded = wasmInstance.decode_style_info(
    styleSection,
    config['isLazy'] === 'true' ? cardURL : undefined,
    config['enableCSSSelector'] === 'true',
    transforms.transformVW,
    transforms.transformVH,
    transforms.transformREM,
  );
  return {
    config,
    css: wasmInstance.get_style_content(decoded),
    fontFace: wasmInstance.get_font_face_content(decoded),
  };
}

/**
 * Captures the style elements the fast path creates, the same way
 * `style-fast-path.spec.ts` does - a resource exposes no getter for them.
 */
function viaMarkupPath(source: string, transforms = {
  transformVW: false,
  transformVH: false,
  transformREM: false,
}) {
  const captured: string[] = [];
  const fakeDocument = {
    createElement: () => ({
      set textContent(value: string) {
        captured.push(value);
      },
    }),
  };
  const result = buildMarkupTemplate(
    source,
    cardURL,
    wasmInstance as never,
    fakeDocument,
    transforms,
  );
  return { result, captured };
}

describe('markup template on the main thread', () => {
  beforeEach(() => {
    resetDiscardedAtRuleReports();
  });

  test('yields the same page config as the bundle path', () => {
    const source = xml({
      style: '.a{color:red}',
      background: 'globalThis.x=1',
    });
    const { result } = viaMarkupPath(source);
    if (!result.success) {
      throw new Error(result.message);
    }
    expect(result.template.config).toStrictEqual(viaBundle(source).config);
  });

  test.each([
    ['plain rules', '.a{color:red}'],
    ['a lynx property', '.a{display:linear;linear-direction:row}'],
    ['a font face', '@font-face{font-family:X;src:url(a.woff2)}'],
    [
      'both sections',
      '@font-face{font-family:Y;src:url(b.woff2)}.a{color:blue}',
    ],
    ['keyframes', '@keyframes k{from{opacity:0}to{opacity:1}}'],
    ['a css var', ':root{--a:#f00}.t{color:var(--a)}'],
  ])('yields the same stylesheet as the bundle path: %s', (_name, style) => {
    const source = xml({ style });
    const { captured } = viaMarkupPath(source);
    const bundle = viaBundle(source);
    expect(captured).toStrictEqual([bundle.css, bundle.fontFace]);
  });

  test('applies the unit transforms it is given', () => {
    const source = xml({ style: '.a{width:100vw;font-size:1rem}' });
    const transforms = {
      transformVW: true,
      transformVH: true,
      transformREM: true,
    };
    const { captured } = viaMarkupPath(source, transforms);
    const bundle = viaBundle(source, transforms);
    expect(captured).toStrictEqual([bundle.css, bundle.fontFace]);
    // Guards against both sides degenerating to passthrough: the rewrite has to
    // have actually happened.
    expect(captured[0]).toContain('rem-unit');
  });

  test('translates a lynx property rather than passing it through', () => {
    const { captured } = viaMarkupPath(
      xml({ style: '.a{display:linear}' }),
    );
    // `display:linear` is not a value any browser accepts - left verbatim it is
    // dropped as invalid and the element falls back to `display:block`, which is
    // what makes the tokenized channel necessary rather than a nicety. The
    // decoder emits a real `display:flex` plus the custom properties the runtime
    // reads, so assert on the standard declaration specifically.
    expect(captured[0]).toContain('display:flex');
    expect(captured[0]).toContain('--lynx-display:linear');
    expect(captured[0]).not.toMatch(/[;{]display:\s*linear/);
  });

  test('exposes the main-thread and background scripts as blob urls', () => {
    const { result } = viaMarkupPath(
      xml({ style: '.a{color:red}', background: 'globalThis.bts=1' }),
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    expect(Object.keys(result.template.lepusCode!)).toStrictEqual(['root']);
    expect(result.template.lepusCode!['root']).toMatch(/^blob:/);
    expect(Object.keys(result.template.backgroundCode!)).toStrictEqual([
      '/app-service.js',
    ]);
    expect(result.template.backgroundCode!['/app-service.js']).toMatch(
      /^blob:/,
    );
  });

  test('omits a stylesheet when the document has no style section', () => {
    const { result, captured } = viaMarkupPath(xml());
    if (!result.success) {
      throw new Error(result.message);
    }
    // No `styleInfo` entry at all, so no resource is built - distinct from a
    // present but empty `<style>`, which does produce one.
    expect(result.template.styleSheet).toBeUndefined();
    expect(captured).toStrictEqual([]);
  });

  test('builds a stylesheet for a present but empty style section', () => {
    const { result } = viaMarkupPath(xml({ style: '' }));
    if (!result.success) {
      throw new Error(result.message);
    }
    expect(result.template.styleSheet).toBeDefined();
  });

  test('returns the parser message instead of throwing', () => {
    const { result } = viaMarkupPath('<lynx>no closing tag');
    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure');
    }
    expect(result.message).toMatch(/lynx/i);
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('reports each discarded at-rule once, however many there are', () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => {
      warnings.push(message);
    };
    try {
      viaMarkupPath(xml({
        style:
          '@media (max-width:1px){.a{color:red}}@media print{.b{color:blue}}@property --x{syntax:"*"}',
      }));
    } finally {
      console.warn = original;
    }
    const markupWarnings = warnings.filter((line) =>
      line.includes('[lynx-web]')
    );
    // Two `@media` blocks, one line.
    expect(markupWarnings.filter((l) => l.includes('@media'))).toHaveLength(1);
    expect(markupWarnings.filter((l) => l.includes('@property'))).toHaveLength(
      1,
    );
  });

  test('reports the same at-rules the bundle path reports', () => {
    const source = xml({
      style: '@media print{.a{color:red}}@property --x{syntax:"*"}',
    });
    const { result } = viaMarkupPath(source);
    if (!result.success) {
      throw new Error(result.message);
    }
    const built = encodeLynxXML(source);
    if (!built.success) {
      throw new Error(built.message);
    }
    expect(result.discarded).toStrictEqual(built.discarded);
  });
});
