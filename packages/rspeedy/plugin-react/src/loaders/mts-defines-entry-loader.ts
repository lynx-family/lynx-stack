// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

/**
 * The query that turns the assembled-definitions runtime into the single
 * main-thread entry module, carrying the app's own entry imports with it.
 *
 * @internal
 */
export const MTS_ENTRY_QUERY = 'lynx-mts-entry'

/**
 * Emits the one module the main thread enters through: the assembled
 * definitions runtime, then the app's entry.
 *
 * Listing the two as separate entry imports would be the obvious spelling,
 * and it costs the whole main-thread runtime its scope hoisting — every
 * module the two roots share has an incoming connection from each, so
 * `ModuleConcatenationPlugin` can inline it into neither and the runtime is
 * emitted module by module instead. One root, two imports, and it is
 * concatenated again.
 *
 * Import order is execution order: the definitions runtime installs the
 * assembled snapshot and worklet definitions before any of the app's own
 * module bodies run.
 *
 * @internal
 */
export default function mtsDefinesEntryLoader(
  this: Rspack.LoaderContext,
): string {
  const imports = JSON.parse(
    new URLSearchParams(this.resourceQuery.slice(1)).get(MTS_ENTRY_QUERY)
      ?? '[]',
  ) as string[]

  return [
    `import ${JSON.stringify(this.resourcePath)};`,
    ...imports.map(request => `import ${JSON.stringify(request)};`),
  ].join('\n') + '\n'
}
