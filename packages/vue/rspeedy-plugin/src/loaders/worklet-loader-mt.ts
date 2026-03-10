// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Webpack loader for the Main Thread (LEPUS) layer.
 *
 * Applied to .js/.ts files when imported from the MT entry.
 * For each file:
 *  1. Extract local (relative-path) imports to preserve webpack dep graph
 *  2. Quick-check for 'main thread' directive — skip LEPUS transform if absent
 *  3. SWC with target='LEPUS' → produces registerWorkletInternal calls
 *  4. Extract only registerWorkletInternal(...) calls
 *  5. Return local imports + extracted registrations as module content
 *
 * Files without 'main thread' directives return only their local imports.
 * This preserves the dependency chain so webpack can reach files that DO
 * contain worklet registrations (e.g. index.ts → App.vue).
 *
 * Vue script sub-modules (?vue&type=script) require special handling:
 * VueLoaderPlugin clones rules for ?vue sub-modules. With
 * experimentalInlineMatchResource, rspack creates a proxy module that
 * re-exports from the inline module (`export { default } from "..."`)
 * even though the .vue connector on MT is converted to a side-effect
 * import. The proxy's re-export must be satisfiable, so we emit a dummy
 * `export default {}` alongside registrations.
 */

import type { Rspack } from '@rsbuild/core';

import { transformReactLynxSync } from '@lynx-js/react/transform';

import { extractLocalImports, extractRegistrations } from './worklet-utils.js';

export default function workletLoaderMT(
  this: Rspack.LoaderContext,
  source: string,
): string {
  this.cacheable(true);

  // Vue script sub-modules: the inline match resource proxy re-exports
  // `export { default } from "...inline..."`. If we strip exports entirely,
  // the proxy fails with ESModulesLinkingError. Instead, emit local imports
  // + registrations + a dummy default export to satisfy the proxy. The
  // connector's side-effect import means the proxy's exports are unused
  // and will be tree-shaken.
  if (
    this.resourceQuery?.includes('vue')
    && this.resourceQuery?.includes('type=script')
  ) {
    const localImports = extractLocalImports(source);

    if (
      !source.includes('\'main thread\'') && !source.includes('"main thread"')
    ) {
      return (localImports ? localImports + '\n' : '') + 'export default {};';
    }

    const resourcePath = this.resourcePath;
    const lepusResult = transformReactLynxSync(source, {
      pluginName: 'vue:worklet-mt',
      filename: resourcePath,
      sourcemap: false,
      cssScope: false,
      shake: false,
      compat: false,
      refresh: false,
      defineDCE: false,
      directiveDCE: false,
      worklet: {
        target: 'LEPUS',
        filename: resourcePath,
        runtimePkg: '@lynx-js/vue-runtime',
      },
    });

    if (lepusResult.errors.length > 0) {
      for (const err of lepusResult.errors) {
        this.emitError(
          new Error(`[worklet-loader-mt] LEPUS transform: ${err.text}`),
        );
      }
      return (localImports ? localImports + '\n' : '') + 'export default {};';
    }

    const registrations = extractRegistrations(lepusResult.code);
    const parts = [localImports, registrations, 'export default {};'].filter(
      Boolean,
    );
    return parts.join('\n');
  }

  // Regular .js/.ts files (not vue sub-modules):
  // Strip everything except local imports and registrations.

  // Preserve local (relative-path) imports so webpack follows the dependency
  // graph to sub-modules that may contain worklet registrations.
  const localImports = extractLocalImports(source);

  // Quick check: skip LEPUS transform for files without 'main thread' directive
  if (
    !source.includes('\'main thread\'') && !source.includes('"main thread"')
  ) {
    return localImports;
  }

  const resourcePath = this.resourcePath;
  const filename = resourcePath;

  const lepusResult = transformReactLynxSync(source, {
    pluginName: 'vue:worklet-mt',
    filename,
    sourcemap: false,
    cssScope: false,
    shake: false,
    compat: false,
    refresh: false,
    defineDCE: false,
    directiveDCE: false,
    worklet: {
      target: 'LEPUS',
      filename,
      runtimePkg: '@lynx-js/vue-runtime',
    },
  });

  if (lepusResult.errors.length > 0) {
    for (const err of lepusResult.errors) {
      this.emitError(
        new Error(`[worklet-loader-mt] LEPUS transform: ${err.text}`),
      );
    }
    return localImports;
  }

  // Return local imports (for dep graph) + extracted registrations
  const registrations = extractRegistrations(lepusResult.code);
  if (!registrations) return localImports;
  return localImports ? localImports + '\n' + registrations : registrations;
}
