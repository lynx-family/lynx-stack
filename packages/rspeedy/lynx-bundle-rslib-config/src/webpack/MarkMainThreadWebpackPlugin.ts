// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

const PLUGIN_NAME = 'MarkMainThreadWebpackPlugin'

/**
 * Marks the assets of every chunk holding main-thread modules, the way a page
 * build marks its own, so the encoder and the runtime wrapper tell the threads
 * apart by the same mark.
 */
export class MarkMainThreadWebpackPlugin {
  constructor(private options: { layer: string }) {}

  apply(compiler: Rspack.Compiler): void {
    const { layer } = this.options

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const entryChunks = new Set<Rspack.Chunk>()
          for (const [name, { options }] of compilation.entries) {
            if (options.layer !== layer) {
              continue
            }
            for (
              const chunk of compilation.entrypoints.get(name)?.chunks ?? []
            ) {
              entryChunks.add(chunk)
            }
          }
          for (const chunk of compilation.chunks) {
            const modules = compilation.chunkGraph.getChunkModulesIterable(
              chunk,
            )
            if (
              !entryChunks.has(chunk)
              && !Array.from(modules).some((module) => module.layer === layer)
            ) {
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
