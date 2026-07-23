// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Asset, Compilation, Compiler } from '@rspack/core'

import { cssChunksToMap } from '@lynx-js/css-serializer'
import type { LynxStyleNode } from '@lynx-js/css-serializer'

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

  /**
   * The main thread chunks of the external bundle.
   *
   * @defaultValue []
   */
  mainThreadChunks?: string[] | undefined

  /**
   * Whether to tag main thread chunks with the `JsBytecode` encoding so the
   * encoder compiles them to bytecode.
   *
   * @remarks
   * When disabled, main thread chunks are encoded as plain JavaScript source,
   * which keeps them readable for debugging and speeds up encoding.
   *
   * @defaultValue `false` when `NODE_ENV` is `'development'`, otherwise `true`
   */
  enableJsBytecode?: boolean | undefined
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
    // `rslib build` always compiles with rspack mode `production`, so the
    // development signal here is `NODE_ENV`, matching the `minify` default
    // of `DEFAULT_EXTERNAL_BUNDLE_LIB_CONFIG`.
    const enableJsBytecode = this.options.enableJsBytecode
      ?? process.env['NODE_ENV'] !== 'development'
    const { buffer, encodeOptions } = await this.#encode(
      assets,
      enableJsBytecode,
    )

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

  async #encode(assets: readonly Asset[], enableJsBytecode: boolean) {
    const customSections = assets
      .reduce<
        Record<string, {
          content: string | {
            ruleList: LynxStyleNode[]
          }
        }>
      >(
        (prev, cur) => {
          switch (cur.info.assetType) {
            case 'javascript':
              return ({
                ...prev,
                [cur.name.replace(/\.js$/, '')]: {
                  ...(enableJsBytecode
                      && this.options.mainThreadChunks?.includes(cur.name)
                    ? {
                      'encoding': 'JsBytecode',
                    }
                    : {}),
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
      useLepusNG: true,
      isExternalBundle: true,
      isLazy: false,
      // `lynx.fetchBundle` and `lynx.loadScript` require engineVersion >= 3.5
      targetSdkVersion: this.options.engineVersion ?? '3.5',
      enableCSSInvalidation: true,
      enableCSSSelector: true,
      debugInfoOutside: true,
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
