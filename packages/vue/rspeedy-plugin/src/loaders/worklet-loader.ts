// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Webpack loader that runs the SWC worklet transform on Background layer files.
 *
 * For each file in the Background layer:
 *  1. Quick-check for 'main thread' directive — skip files without it
 *  2. SWC with target='JS' → replaces worklet functions with context objects
 *  3. Return the JS output to webpack
 *
 * LEPUS registration extraction is handled separately by worklet-loader-mt
 * on the Main Thread layer, which provides natural per-entry isolation
 * via webpack's dependency graph.
 */

import type { Rspack } from '@rsbuild/core';

import { transformReactLynxSync } from '@lynx-js/react/transform';

export default function workletLoader(
  this: Rspack.LoaderContext,
  source: string,
): string {
  this.cacheable(true);

  // Quick check: skip files that don't contain the 'main thread' directive
  if (
    !source.includes('\'main thread\'') && !source.includes('"main thread"')
  ) {
    return source;
  }

  const resourcePath = this.resourcePath;
  const filename = resourcePath;

  // JS target — replaces worklet functions with context objects
  const jsResult = transformReactLynxSync(source, {
    pluginName: 'vue:worklet',
    filename,
    sourcemap: false,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    defineDCE: false,
    directiveDCE: false,
    worklet: {
      target: 'JS',
      filename,
      runtimePkg: '@lynx-js/vue-runtime',
    },
  });

  if (jsResult.errors.length > 0) {
    for (const err of jsResult.errors) {
      this.emitError(new Error(`[worklet-loader] JS transform: ${err.text}`));
    }
    return source;
  }

  return jsResult.code;
}
