// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

import type { Rspack } from '@rsbuild/core';

import { runSwcTransform } from './main-thread-block-loader.js';

/**
 * Pre-loader (enforce: 'pre') for `.vue` files that transforms
 * `<script main-thread>` blocks before vue-loader splits the SFC.
 *
 * **BG mode** (`target: 'BG'`):
 *   1. Find `<script main-thread ...>` block.
 *   2. Run SWC BG transform → worklet context object declarations.
 *   3. Strip `export` keywords (make them local declarations).
 *   4. Inject at the end of `<script setup>` content.
 *   5. Remove the `<script main-thread>` block.
 *   6. Return modified `.vue` — vue-loader processes it normally.
 *
 * The injected declarations are in `<script setup>` scope, so they are
 * automatically exposed to the template and can be used as:
 *   `:main-thread-bindtap="onTap"`
 *
 * **MT mode** (`target: 'MT'`):
 *   1. Find `<script main-thread ...>` block.
 *   2. Run SWC MT transform → `registerWorkletInternal(...)` calls.
 *   3. Return a minimal `.vue` with those calls in a plain `<script>` (no
 *      `setup` attribute), so the null-loader rule (which only matches
 *      `?vue&type=script&setup=true`) does NOT silence them.
 *   4. If no `<script main-thread>` block: return an empty `.vue` so
 *      nothing from the component leaks into the MT bundle.
 */
export default function vueMainThreadPreLoader(
  this: Rspack.LoaderContext,
  source: string,
): void {
  this.cacheable(true);

  const callback = this.async();
  const options = this.getOptions() as { target: 'BG' | 'MT' };
  const target = options.target ?? 'BG';

  const mtBlock = findScriptMainThreadBlock(source);

  if (!mtBlock) {
    if (target === 'MT') {
      // No worklet block — return empty .vue so nothing leaks into MT bundle.
      callback(null, '<script setup></script>\n<template></template>');
    } else {
      callback(null, source);
    }
    return;
  }

  const contextRoot = this.rootContext ?? this.context;
  const relativeFilename = path
    .relative(contextRoot, this.resourcePath)
    .replaceAll(path.sep, '/');

  runSwcTransform(mtBlock.content.trim(), relativeFilename, target, {})
    .then((transformed: string) => {
      if (target === 'MT') {
        callback(
          null,
          `<script>\n${transformed}\n</script>\n<template></template>`,
        );
      } else {
        // Strip `export` to turn module exports into local setup declarations.
        const declarations = transformed.replace(
          /^export\s+(const|let|var|function|class)\s+/gm,
          '$1 ',
        );
        const modified = injectIntoScriptSetup(source, mtBlock, declarations);
        callback(null, modified);
      }
    })
    .catch((err: Error) => callback(err));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ScriptBlock {
  /** Raw content between the opening and closing tags. */
  content: string;
  /** Start offset of the opening `<script` tag in the source. */
  start: number;
  /** End offset just after `</script>`. */
  end: number;
}

/**
 * Locate the first `<script main-thread ...>...</script>` block.
 *
 * HTML comments are blanked out (replaced with equal-length whitespace) before
 * the regex runs, so `<script main-thread>` mentioned inside a `<!-- -->` doc
 * comment is not mistaken for an actual block.  Offsets remain valid because
 * the replacement preserves string length.
 */
function findScriptMainThreadBlock(source: string): ScriptBlock | null {
  // Blank HTML comments to avoid false matches on documented usage examples.
  const stripped = source.replace(
    /<!--[\s\S]*?-->/g,
    (m) => ' '.repeat(m.length),
  );

  // `^` with the `m` flag ensures we only match at the start of a line.
  // SFC top-level blocks always start at column 0; inline text references
  // (e.g. in JS comments inside <script setup>) never do.
  // eslint-disable-next-line regexp/no-contradiction-with-assertion
  const openRe = /^<script\b(?=[^>]*\bmain-thread\b)[^>]*>/im;
  const openMatch = openRe.exec(stripped);
  if (!openMatch) return null;

  // Use the original source for content (comments are preserved inside blocks).
  const contentStart = openMatch.index + openMatch[0].length;
  const closeIndex = source.indexOf('</script>', contentStart);
  if (closeIndex === -1) return null;

  return {
    content: source.slice(contentStart, closeIndex),
    start: openMatch.index,
    end: closeIndex + '</script>'.length,
  };
}

interface SetupScriptBlock {
  /** Offset of the first character inside the block (after the opening tag). */
  contentStart: number;
  /** Offset of the `<` in `</script>`. */
  contentEnd: number;
}

/** Locate `<script setup ...>...</script>`. */
function findScriptSetupBlock(source: string): SetupScriptBlock | null {
  // eslint-disable-next-line regexp/no-contradiction-with-assertion
  const openRe = /^<script\b(?=[^>]*\bsetup\b)[^>]*>/im;
  const openMatch = openRe.exec(source);
  if (!openMatch) return null;

  const contentStart = openMatch.index + openMatch[0].length;
  const closeIndex = source.indexOf('</script>', contentStart);
  if (closeIndex === -1) return null;

  return { contentStart, contentEnd: closeIndex };
}

/**
 * Remove the `<script main-thread>` block from `source` and append
 * `declarations` to the `<script setup>` block's content.
 */
function injectIntoScriptSetup(
  source: string,
  mtBlock: ScriptBlock,
  declarations: string,
): string {
  // 1. Remove the <script main-thread> block.
  const without = source.slice(0, mtBlock.start) + source.slice(mtBlock.end);

  // 2. Find <script setup> in the modified source.
  const setup = findScriptSetupBlock(without);
  if (!setup) {
    // No setup block — nothing to inject into; return without the MT block.
    return without;
  }

  // 3. Inject declarations just before the closing </script>.
  return (
    without.slice(0, setup.contentEnd)
    + '\n// [vue-main-thread-pre-loader: injected worklet context objects]\n'
    + declarations
    + '\n'
    + without.slice(setup.contentEnd)
  );
}
