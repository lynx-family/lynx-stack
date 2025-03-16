// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mergeRsbuildConfig } from '@rsbuild/core'

import type { Config } from './index.js'

/**
 * Merge multiple Rspeedy configuration objects.
 *
 * @param configs - The Rspeedy configuration objects to merge.
 *
 * @returns The merged Rspeedy configuration object.
 *
 * @example
 *
 * ```ts
 * import { mergeRspeedyConfig } from '@lynx-js/rspeedy';
 *
 * const config1 = {
 *   dev: {
 *     writeToDisk: false,
 *   },
 * };
 * const config2 = {
 *   dev: {
 *     writeToDisk: true,
 *   },
 * };
 *
 * const mergedConfig = mergeRspeedyConfig(config1, config2);
 *
 * console.log(mergedConfig); // { dev: { writeToDisk: true } }
 * ```
 *
 * @remarks
 *
 * This is actually an alias of {@link https://rsbuild.dev/api/javascript-api/core#mergersbuildconfig | mergeRsbuildConfig}.
 *
 * @public
 */
export function mergeRspeedyConfig(
  ...configs: Config[]
): Config {
  return mergeRsbuildConfig(...configs)
}
