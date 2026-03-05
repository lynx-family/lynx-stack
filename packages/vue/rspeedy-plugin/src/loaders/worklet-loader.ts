// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Webpack loader that runs the SWC worklet transform on vue-loader output.
 *
 * For each file in the Background layer:
 *  1. SWC with target='JS' → replaces worklet functions with context objects
 *  2. SWC with target='LEPUS' → produces registerWorkletInternal calls
 *  3. Extract registrations from LEPUS output (strip boilerplate)
 *  4. Store registrations via worklet-registry (VueMainThreadPlugin appends them)
 *  5. Return the JS output to webpack
 *
 * Files without 'main thread' directives pass through unchanged (SWC is fast).
 */

import type { Rspack } from '@rsbuild/core';

import { transformReactLynxSync } from '@lynx-js/react/transform';

import { addLepusRegistration } from '../worklet-registry.js';

/**
 * Extract registerWorkletInternal(...) calls from LEPUS output.
 *
 * The LEPUS output contains:
 *   - import { loadWorkletRuntime } from "..."
 *   - var loadWorkletRuntime = __loadWorkletRuntime;
 *   - worklet object declarations
 *   - loadWorkletRuntime(...) && registerWorkletInternal(type, hash, fn);
 *
 * We only need the registerWorkletInternal(...) calls. Uses bracket-depth
 * counting to handle nested braces in function bodies.
 */
function extractRegistrations(lepusCode: string): string {
  const registrations: string[] = [];
  const marker = 'registerWorkletInternal(';
  let searchFrom = 0;

  while (true) {
    const idx = lepusCode.indexOf(marker, searchFrom);
    if (idx === -1) break;

    // Find the end of the registerWorkletInternal(...) call using bracket counting
    let depth = 0;
    let i = idx + marker.length - 1; // position of the opening '('
    for (; i < lepusCode.length; i++) {
      if (lepusCode[i] === '(') depth++;
      else if (lepusCode[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }

    // Extract the full call including trailing semicolon
    let end = i + 1;
    if (end < lepusCode.length && lepusCode[end] === ';') end++;

    registrations.push(lepusCode.slice(idx, end));
    searchFrom = end;
  }

  return registrations.join('\n');
}

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

  // Shared options for both passes (only worklet enabled, everything else off)
  const sharedOpts = {
    pluginName: 'vue:worklet',
    filename,
    sourcemap: false as const,
    cssScope: false as const,
    shake: false as const,
    compat: false as const,
    refresh: false as const,
    defineDCE: false as const,
    directiveDCE: false as const,
  };

  // Pass 1: JS target — replaces worklet functions with context objects
  const jsResult = transformReactLynxSync(source, {
    ...sharedOpts,
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

  // If the JS output is identical to input, no worklets were found
  if (jsResult.code === source) {
    return source;
  }

  // Pass 2: LEPUS target — produces registerWorkletInternal calls
  const lepusResult = transformReactLynxSync(source, {
    ...sharedOpts,
    worklet: {
      target: 'LEPUS',
      filename,
      runtimePkg: '@lynx-js/vue-runtime',
    },
  });

  if (lepusResult.errors.length > 0) {
    for (const err of lepusResult.errors) {
      this.emitError(
        new Error(`[worklet-loader] LEPUS transform: ${err.text}`),
      );
    }
    return jsResult.code;
  }

  // Extract registerWorkletInternal(...) calls from LEPUS output
  const registrations = extractRegistrations(lepusResult.code);
  if (registrations) {
    addLepusRegistration(resourcePath, registrations);
  }

  return jsResult.code;
}
