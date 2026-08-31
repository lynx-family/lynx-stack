// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

const PLUGIN_NAME = 'MarkMainThreadWebpackPlugin'

/**
 * Marks the assets of the given entries as main thread ones, the way a page
 * build marks its own. A DSL plugin marks whatever else it compiles for the
 * main thread, so the two add up.
 */
export class MarkMainThreadWebpackPlugin {
  constructor(private options: { entryNames: string[] }) {}

  apply(compiler: Rspack.Compiler): void {
    const entryNames = new Set(this.options.entryNames)

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          for (const chunk of compilation.chunks) {
            if (chunk.name === undefined || !entryNames.has(chunk.name)) {
              continue
            }
            for (const file of chunk.files) {
              if (!file.endsWith('.js')) {
                continue
              }
              const asset = compilation.getAsset(file)
              if (asset === undefined) {
                continue
              }
              compilation.updateAsset(file, asset.source, {
                ...asset.info,
                'lynx:main-thread': true,
              })
            }
          }
        },
      )
    })
  }
}
