// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The bundle compiler must stay out of the eager worker chunk.
 *
 * `TemplateManager` requests the decode worker with `webpackPrefetch`,
 * `webpackPreload` and `fetchPriority: "high"`. Anything `decode.worker.ts`
 * imports statically is therefore eagerly fetched for *every* card - and what is
 * behind this particular import is a CSS parser plus the `binary/encode` wasm,
 * measured at 227.8 kB of JS and 167.7 kB of wasm. A card built ahead of time
 * never needs any of it.
 *
 * None of that is observable behaviourally: turn the dynamic `import()` into a
 * static one and every test still passes, the card still loads, it is just slower
 * for everyone who never writes markup. So it is guarded at the source level.
 *
 * The built artifacts corroborate this from the other side - the encode wasm asset
 * appears once in `web-core-markup-encoder.js` and zero times in `client.js`, the
 * worker chunk and the main chunk - but that measurement needs a bundle and does
 * not belong in a unit test. It is recorded in the changeset instead.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, test } from '@rstest/core';

const WORKER = '../ts/client/decodeWorker/decode.worker.ts';
const ENCODER_SPECIFIER = '../../encode/xmlToTasmJSON.js';

const workerSource = readFileSync(
  new URL(WORKER, import.meta.url),
  'utf8',
);

/**
 * The prose above the import names the module and the reason, so the assertions
 * about *code* have to run with the comments removed - otherwise rewording a
 * comment could turn a guard into a pass, or a mention in prose could satisfy
 * one.
 */
const workerCode = workerSource
  .replace(/\/\*[^]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('the bundle compiler stays behind a lazy import', () => {
  /**
   * Known-positive control. Without it, every `not.toMatch` below would pass
   * just as well against an empty string - which is what a greedy comment strip
   * would leave behind.
   */
  test('the comment stripping left the worker code behind', () => {
    expect(workerCode).toContain('async function handleMarkup');
    expect(workerCode).toContain('async function handleStream');
    expect(workerCode.length).toBeGreaterThan(4000);
  });

  test('the worker names the encoder module exactly once', () => {
    // Guards the assertions below against silently stopping to look at
    // anything, should the module be renamed or moved.
    const references = workerCode.split(ENCODER_SPECIFIER).length - 1;
    expect(references).toBe(1);
  });

  test('and reaches it only through a dynamic import()', () => {
    expect(workerSource).toMatch(
      /import\(\s*(?:\/\*[^]*?\*\/\s*)*'\.\.\/\.\.\/encode\/xmlToTasmJSON\.js'\s*\)/,
    );
    // No static import of it, and no static import of anything else under
    // `ts/encode/` either: `webEncoder`, `encodeCSS` and `index` all reach the
    // same wasm.
    expect(workerCode).not.toMatch(/^\s*import\s[^\n]*'\.\.\/\.\.\/encode\//m);
    expect(workerCode).not.toMatch(
      /^\s*export\s[^\n]*from\s[^\n]*'\.\.\/\.\.\/encode\//m,
    );
  });

  test('and marks the chunk lazy rather than eager', () => {
    expect(workerSource).toContain(
      'webpackChunkName: "web-core-markup-encoder"',
    );
    expect(workerSource).toContain('webpackMode: "lazy"');
    // The worker chunk is requested with prefetch, preload and high priority;
    // these three are what stop this chunk from inheriting them.
    expect(workerSource).toContain('webpackPrefetch: false');
    expect(workerSource).toContain('webpackPreload: false');
    expect(workerSource).toContain('webpackFetchPriority: "low"');
  });

  /**
   * The corrupt-bundle diagnosis has to be decided before the chunk is
   * requested, or every misconfigured server response downloads a few hundred
   * kilobytes only to be rejected. Ordering, unlike the presence of the check,
   * has no behavioural signature under jsdom, so it is read off the source.
   */
  test('and decides a corrupt bundle before requesting the chunk', () => {
    const guard = workerCode.indexOf('startsXMLDocument(source)');
    const request = workerCode.indexOf('loadMarkupEncoder()');
    expect(guard).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(request);
  });
});
