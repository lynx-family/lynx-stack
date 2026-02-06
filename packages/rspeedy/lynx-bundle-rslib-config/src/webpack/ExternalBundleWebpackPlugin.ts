// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Asset, Compilation, Compiler } from 'webpack'

import { cssChunksToMap } from './css/index.js'
import type { LynxStyleNode } from './css/index.js'

/**
 * The options for {@link ExternalBundleWebpackPlugin}.
 *
 * @public
 */
export interface ExternalBundleWebpackPluginOptions {
  /**
   * The external bundle filename.
   *
   * @example
   * ```js
   * new ExternalBundleWebpackPlugin({
   *   bundleFileName: 'lib.lynx.bundle'
   * })
   * ```
   */
  bundleFileName: string
  /**
   * The encode method which is exported from lynx-tasm package.
   *
   * @example
   * ```js
   * import { getEncodeMode } from '@lynx-js/tasm';
   *
   * new ExternalBundleWebpackPlugin({
   *   encode: getEncodeMode()
   * })
   * ```
   */
  encode: (opts: unknown) => Promise<{ buffer: Buffer }>
  /**
   * The engine version of the external bundle.
   *
   * @defaultValue '3.5'
   */
  engineVersion?: string | undefined
}

const isDebug = (): boolean => {
  if (!process.env['DEBUG']) {
    return false
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',')
  return ['rsbuild', 'rspeedy', '*'].some((key) => values.includes(key))
}

/**
 * The webpack plugin to build and emit the external bundle.
 *
 * @public
 */
export class ExternalBundleWebpackPlugin {
  constructor(private options: ExternalBundleWebpackPluginOptions) {}

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      ExternalBundleWebpackPlugin.name,
      (compilation) => {
        compilation.hooks.processAssets.tapPromise(
          {
            name: ExternalBundleWebpackPlugin.name,
            stage:
              /**
               * Generate the html after minification and dev tooling is done
               * and source-map is generated
               */
              compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
          },
          () => {
            return this.#generateExternalBundle(
              compiler,
              compilation,
            )
          },
        )
      },
    )
  }

  async #generateExternalBundle(
    compiler: Compiler,
    compilation: Compilation,
  ): Promise<void> {
    const assets = compilation.getAssets()
    const { buffer, encodeOptions } = await this.#encode(assets)

    const { RawSource } = compiler.webpack.sources
    compilation.emitAsset(
      this.options.bundleFileName,
      new RawSource(buffer, false),
    )
    if (isDebug()) {
      compilation.emitAsset(
        'tasm.json',
        new RawSource(
          JSON.stringify(encodeOptions, null, 2),
        ),
      )
    } else {
      assets.forEach(({ name }) => {
        compilation.deleteAsset(name)
      })
    }
  }

  async #encode(assets: Readonly<Asset>[]) {
    const customSections = assets
      .reduce<
        Record<string, {
          content: string | {
            ruleList: LynxStyleNode[]
          }
        }>
      >(
        (prev, cur) => {
          switch (cur.info['assetType']) {
            case 'javascript':
              return ({
                ...prev,
                [cur.name.replace(/\.js$/, '')]: {
                  content: cur.source.source().toString(),
                },
              })
            case 'extract-css':
              return ({
                ...prev,
                [`${cur.name.replace(/\.css$/, '')}:CSS`]: {
                  'encoding': 'CSS',
                  content: {
                    ruleList: cssChunksToMap(
                      [cur.source.source().toString()],
                      [],
                      true,
                    ).cssMap[0] ?? [],
                  },
                },
              })
            default:
              return prev
          }
        },
        {},
      )

    const compilerOptions: Record<string, unknown> = {
      enableFiberArch: true,
      // `lynx.fetchBundle` and `lynx.loadScript` require engineVersion >= 3.5
      targetSdkVersion: this.options.engineVersion ?? '3.5',
      enableCSSInvalidation: true,
      enableCSSSelector: true,
    }

    const encodeOptions = {
      compilerOptions,
      sourceContent: {
        appType: 'DynamicComponent',
      },
      customSections,
    }

    const { buffer } = await this.options.encode(encodeOptions)

    return { buffer, encodeOptions }
  }
}
