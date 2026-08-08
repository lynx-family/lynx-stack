// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Guards the build-output (JSON artifact) style path against changes made for
 * the buildless XML path.
 *
 * Both formats are assembled by the same `loadStyleFromJSON`, so work on one can
 * silently alter the other. The hashes below were captured from the encoder
 * *before* the XML tokenization work landed, which is what makes them evidence
 * rather than a snapshot of current behaviour: if a change to the XML path
 * perturbs a ReactLynx card's stylesheet by even one byte, they fail.
 *
 * A hash mismatch is not automatically a bug - an intentional change to the
 * shared encoder legitimately moves them - but it must never change as a
 * side effect, so updating one is a deliberate act that needs justification.
 */

import './jsdom.js';
import { describe, expect, rstest, test } from '@rstest/core';
import { createHash } from 'node:crypto';

rstest.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
  simd: async () => true,
}));

await import('../ts/client/wasm.js');
const { loadStyleFromJSON } = await import(
  '../ts/client/decodeWorker/cssLoader.js'
);

/**
 * A stylesheet in the shape a built card produces, exercising every feature the
 * JSON path has: the raw `content` channel, the tokenized `rules` channel,
 * cross-stylesheet `imports`, a pseudo class, a `[lynx-tag=page]` selector, a
 * combinator chain and a Lynx-specific declaration.
 */
const jsonStyleInfo = {
  '0': {
    content: ['.raw{color:red}'],
    rules: [
      {
        sel: [[['.a'], [], [], []]],
        decl: [['color', 'blue'], ['padding', '1rem']],
      },
      { sel: [[['.b'], [':hover'], [], []]], decl: [['display', 'linear']] },
      { sel: [[['[lynx-tag=page]'], [], [], []]], decl: [['width', '100%']] },
      {
        sel: [[['.c'], [], [], ['>']], [['.d'], [], [], []]],
        decl: [['color', 'green']],
      },
    ],
    imports: ['1'],
  },
  '1': {
    content: [],
    rules: [{ sel: [[['.imported'], [], [], []]], decl: [['color', '#fff']] }],
  },
};

function fingerprint(
  configEnableCSSSelector: boolean,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  entryName?: string,
): string {
  const buffer = loadStyleFromJSON(
    // Cloned per call: the loader is handed ownership of what it receives.
    structuredClone(jsonStyleInfo) as never,
    configEnableCSSSelector,
    transformVW,
    transformVH,
    transformREM,
    entryName,
  );
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

describe('JSON artifact style path', () => {
  test('encodes byte for byte as it did before XML tokenization', () => {
    // Captured at commit c045b53b6, i.e. with the XML path still on the raw
    // `content` channel.
    expect(fingerprint(true, false, false, false)).toBe(
      '1a87d7fe32aee8e8100c83bd93b094bd32da3b4cba8262054c4226aee9d8d606',
    );
    expect(fingerprint(true, false, false, true)).toBe(
      'e3a80888df4547d3be5a2b7c57c67b92d24866de3c42e1a61f857fb7401a9d52',
    );
    expect(fingerprint(true, true, true, true)).toBe(
      'e3a80888df4547d3be5a2b7c57c67b92d24866de3c42e1a61f857fb7401a9d52',
    );
    expect(fingerprint(true, false, false, false, 'my-entry')).toBe(
      'b70282cd5b35fbba554a8ab21ca2527381c5d416985ea8fc82e29a4740c6a842',
    );
    expect(fingerprint(false, false, false, false)).toBe(
      '01b17d2c125de286eb689a0c7a79a6f0388f7ed8f0e3936d59a3877c5544017a',
    );
  });

  test('still routes both channels of a JSON stylesheet', () => {
    // The hashes above would also hold if the encoder started emitting nothing
    // at all, so assert the content is really there. `content` before `rules`
    // is the JSON path's long-standing order and must stay that way.
    const buffer = loadStyleFromJSON(
      structuredClone(jsonStyleInfo) as never,
      true,
      false,
      false,
      false,
      undefined,
    );
    const decoded = new TextDecoder().decode(buffer);
    const css = decoded.slice(
      0,
      decoded.indexOf('\u0000') === -1
        ? undefined
        : decoded.indexOf('\u0000'),
    );

    // Raw channel, emitted verbatim.
    expect(css).toContain('.raw{color:red}');
    // Tokenized channel, rewritten by the style engine.
    expect(css).toContain('.a:not([l-e-name])');
    expect(css).toContain('[part="page"]');
    expect(css).toContain('--lynx-display:linear;');
    // Imported stylesheet, scoped by css id.
    expect(css).toContain('l-css-id="1"');
    expect(css.indexOf('.raw{color:red}')).toBeLessThan(
      css.indexOf('.a:not([l-e-name])'),
    );
  });
});
