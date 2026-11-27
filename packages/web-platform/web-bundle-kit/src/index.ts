// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Builds Lynx web bundles in a browser, with Rsbuild, `pluginLynx` and
 * `pluginReactLynx` on top of `@rspack/browser`.
 *
 * Import it in a dedicated module Worker of a cross-origin isolated page.
 *
 * @packageDocumentation
 */

import type {
  BuiltinPackages,
  WebBundler,
  WebBundlerOptions,
} from './types.js';

export type * from './types.js';

declare const __BUILTIN_PACKAGES__: BuiltinPackages;

/**
 * Versions of the packages the kit provides to every project under
 * `node_modules`, by package name.
 *
 * @public
 */
export const builtinPackages: BuiltinPackages = __BUILTIN_PACKAGES__;

/**
 * Creates a bundler for one project.
 *
 * The first call loads Rspack (its wasm and the mirror of the built-in
 * packages) from next to this module, which takes a few seconds.
 *
 * @public
 */
export async function createWebBundler(
  options: WebBundlerOptions,
): Promise<WebBundler> {
  // Rsbuild, the plugins and Rspack are in a chunk of their own, so that
  // importing the kit is cheap and the Node.js stand-ins are set up before
  // any of that code runs.
  const { createWebBundlerImpl } = await import('./bundler.js');
  return createWebBundlerImpl(options);
}
