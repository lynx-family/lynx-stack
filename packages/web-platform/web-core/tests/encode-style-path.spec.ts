// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Byte-level guard on the encode (ReactLynx build) style path.
 *
 * `encodeCSS` runs at build time for every ReactLynx card, so a refactor that
 * makes its conversion reusable by the browser must not move a single byte of
 * its output. The hashes below were captured from `origin/main` before the
 * conversion was extracted, which is what makes them evidence rather than a
 * snapshot of current behaviour.
 *
 * A mismatch is not automatically a bug - an intentional change to the encoder
 * legitimately moves them - but it must never move as a side effect, so updating
 * one is a deliberate act that needs justification.
 */

import { describe, expect, test } from '@rstest/core';
import { createHash } from 'node:crypto';
import * as CSS from '@lynx-js/css-serializer';

import { encodeCSS } from '../ts/encode/encodeCSS.js';

/**
 * One stylesheet per feature the encode path can represent, plus the constructs
 * it deliberately cannot.
 */
const sources: Record<string, string> = {
  plain: '.a{color:red;padding:1rem}',
  selectors:
    '.a .b>.c+.d~.e{color:red}#id[data-x="1"]:hover::before{color:blue}*{margin:0}div{padding:0}',
  variables: ':root{--accent:#f00;font-size:14px}.t{color:var(--accent)}',
  varFallback: '.t{border:var(--w, 2px) solid var(--c)}',
  important: '.a{width:100vw !important;height:50vh;font-size:10rpx}',
  keyframes:
    '@keyframes spin{from{transform:rotate(0);--v:1}to{transform:rotate(360deg)}}',
  fontFace: '@font-face{font-family:X;src:url(a.woff2)}',
  // A css var inside `@font-face` and inside `@keyframes`. Without these two,
  // the `restoreCSSVarValue` call in those branches is indistinguishable from a
  // bare `decl.value`: no other fixture carries a var there, so a mutation that
  // drops the restoration survives the entire set. Measured, not assumed -
  // replacing `restoreCSSVarValue(decl)` with `decl.value` in the `FontFaceRule`
  // branch passed all 9 original fixtures and is caught only once `fontFaceVar`
  // is present.
  fontFaceVar:
    '@font-face{font-family:X;src:url(a.woff2);font-weight:{{--fw}}}',
  keyframesVar: '@keyframes k{from{color:{{--c}}}to{color:blue}}',
  lynxProps: '.a{display:linear;linear-direction:column;flex:1}',
  // Group at-rules: `@media` is carried as `RuleType::Media`; `RuleType` has no
  // variant for the other two, so the encode path drops them. Pinned so that
  // both stay intentional.
  groupAtRules:
    '.a{color:red}@media (max-width:600px){.b{color:blue}}@supports (display:grid){.c{display:grid}}@layer base{.d{color:pink}}.e{color:black}',
};

function fingerprint(css: string): string {
  const buffer = encodeCSS({ '0': CSS.parse(css).root });
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

describe('encode style path', () => {
  test('encodes byte for byte as it did before the conversion was shared', () => {
    // Captured on origin/main at fe63f6cef, i.e. with the conversion still
    // inline in `ts/encode/encodeCSS.ts`.
    const expected: Record<string, string> = {
      plain: '15c134ae85563a76958229342d9631db41681ba615946743267bfb418cd616d1',
      selectors:
        '390f7ce839aa720c280a65011662331b3fef6cfd38dd777cff8f1c402e096c5a',
      variables:
        '4427cce9029ab56bcd309f0b720dca1aed103ec66d7c8d60b908e24b71fe120d',
      varFallback:
        'f5ba7a8c4f2ca62caf6912a0a97e84a9f751b213e42615c2aa42caffa70d0f42',
      important:
        'f4afd7bd210fee4eb8c8825314c55ff9caa4155a4cf845f987a9df1d98ede561',
      keyframes:
        'b9e454bb3bd6536d942bba30535e66d9aa31937bec7c3c737e95d4213228b434',
      fontFace:
        'fea9aa27bae5623785ea94421aefb66bd702100a8776afe613244c5236dda896',
      fontFaceVar:
        'b9affb67c4444921a59aabc8f6ce3ff93311f38b899bc28b0d2ed3c1d2377bd3',
      keyframesVar:
        '5fb65a1a9a913d2d9b78df8c297207b3c7385e7eeb4d3266171c4272fa72c00c',
      lynxProps:
        'a4a5369454a5272dd176930dafbdd559822b274f984bca1e99db59b6afe86a57',
      // Moved deliberately when `@media` became `RuleType::Media`; every other
      // fixture kept its hash through that change.
      groupAtRules:
        'd359b2c69a0da7b92f22eb128d3d888a6d7c9df3ad30ebb9d34c7b92ee422085',
    };
    const actual = Object.fromEntries(
      Object.entries(sources).map(([name, css]) => [name, fingerprint(css)]),
    );
    expect(actual).toStrictEqual(expected);
  });

  test('keeps rejecting what it always rejected', () => {
    expect(() => encodeCSS({ nope: [] })).toThrowError(/Invalid cssId/);
    expect(() =>
      encodeCSS({ '0': CSS.parse('@import url("theme.css");').root })
    ).toThrowError(/Invalid importCssId/);
  });

  test('carries @media and still drops the other group at-rules', () => {
    // The hashes above would also hold if the encoder emitted nothing at all,
    // so assert that the surrounding rules and `@media` survive and the other
    // groups do not.
    const buffer = encodeCSS({ '0': CSS.parse(sources.groupAtRules!).root });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    // The two top-level rules, by their (unique) declaration values.
    expect(text).toContain('red');
    expect(text).toContain('black');
    // `@media`, prelude and body alike.
    expect(text).toContain('max-width');
    expect(text).toContain('blue');
    // Everything the two other groups carried, prelude and body alike.
    expect(text).not.toContain('grid');
    expect(text).not.toContain('pink');
  });
});
