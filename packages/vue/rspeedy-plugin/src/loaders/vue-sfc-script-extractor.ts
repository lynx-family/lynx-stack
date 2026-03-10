// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Webpack loader that extracts `<script>` content from Vue SFC files
 * on the Main Thread layer.
 *
 * On the MT layer, we don't need template compilation or style processing —
 * only the raw `<script>` content where `'main thread'` directives live.
 * worklet-loader-mt then processes the extracted JS for LEPUS registrations.
 *
 * Uses simple regex extraction — sufficient for worklet directive detection.
 * Multiple `<script>` blocks (e.g. `<script>` + `<script setup>`) are
 * concatenated so worklet directives in either block are found.
 */

import type { Rspack } from '@rsbuild/core';

const SCRIPT_BLOCK_RE = /<script[^>]*>([\s\S]*?)<\/script>/g;

export default function vueSfcScriptExtractor(
  this: Rspack.LoaderContext,
  source: string,
): string {
  this.cacheable(true);

  const scripts: string[] = [];
  let match;
  while ((match = SCRIPT_BLOCK_RE.exec(source)) !== null) {
    scripts.push(match[1]!);
  }
  // Reset regex lastIndex for next invocation (stateful global regex)
  SCRIPT_BLOCK_RE.lastIndex = 0;

  // Return concatenated script content — worklet-loader-mt processes it next
  return scripts.join('\n');
}
