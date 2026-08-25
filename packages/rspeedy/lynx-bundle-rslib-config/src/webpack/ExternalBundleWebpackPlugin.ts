// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

import { cssChunksToMap } from '@lynx-js/css-serializer'
import type { LynxStyleNode } from '@lynx-js/css-serializer'
import type {
  LynxTemplatePlugin as LynxTemplatePluginClass,
} from '@lynx-js/template-webpack-plugin'

/**
 * Provides the template lifecycle hooks exposed by an installed DSL plugin.
 *
 * @public
 */
export interface LynxTemplatePluginHooksProvider {
  /**
   * Returns the public template lifecycle hooks for a compilation.
   */
  getLynxTemplatePluginHooks:
    typeof LynxTemplatePluginClass.getLynxTemplatePluginHooks
}

/**
 * The options for {@link ExternalBundleWebpackPlugin}.
 *
 * @public
 */
export interface ExternalBundleWebpackPluginOptions {
  /**
   * The template lifecycle hooks provider exposed by the installed DSL plugin.
   */
  LynxTemplatePlugin: LynxTemplatePluginHooksProvider

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
  encode: (
    opts: unknown,
  ) =>
    | {
      buffer: Buffer
      lepus_debug?: string
      css_diagnostics?: string
    }
    | Promise<{
      buffer: Buffer
      lepus_debug?: string
      css_diagnostics?: string
    }>
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

  apply(compiler: Rspack.Compiler): void {
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
    compiler: Rspack.Compiler,
    compilation: Rspack.Compilation,
  ): Promise<void> {
    const assets = compilation.getAssets()
    // `rslib build` always compiles with rspack mode `production`, so the
    // development signal here is `NODE_ENV`, matching the `minify` default
    // of `DEFAULT_EXTERNAL_BUNDLE_LIB_CONFIG`.
    const enableJsBytecode = this.options.enableJsBytecode
      ?? process.env['NODE_ENV'] !== 'development'
    const { buffer, encodeOptions, hooks } = await this.#encode(
      compilation,
      assets,
      enableJsBytecode,
    )

    const { RawSource } = compiler.webpack.sources
    compilation.emitAsset(
      this.options.bundleFileName,
      new RawSource(buffer, false),
    )
    await hooks.afterEmit.promise({
      outputName: this.options.bundleFileName,
    })
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

  async #encode(
    compilation: Rspack.Compilation,
    assets: readonly Rspack.Asset[],
    enableJsBytecode: boolean,
  ) {
    const compilerOptions: {
      enableCSSSelector: boolean
      targetSdkVersion: string
      [key: string]: string | boolean
    } = {
      enableFiberArch: true,
      useLepusNG: true,
      // `lynx.fetchBundle` and `lynx.loadScript` require engineVersion >= 3.5
      targetSdkVersion: this.options.engineVersion ?? '3.5',
      enableCSSInvalidation: true,
      enableCSSSelector: true,
      debugInfoOutside: true,
    }

    const mainThreadChunkNames = new Set(this.options.mainThreadChunks ?? [])
    const mainThreadAssets: Rspack.Asset[] = []
    const cssAssets: Rspack.Asset[] = []

    for (const asset of assets) {
      let tasmSection: string[] | undefined
      let isMainThread = false
      if (asset.info.assetType === 'javascript') {
        isMainThread = mainThreadChunkNames.has(asset.name)
        tasmSection = ['customSections', asset.name.replace(/\.js$/, '')]
        if (isMainThread) {
          mainThreadAssets.push(asset)
        }
      } else if (asset.info.assetType === 'extract-css') {
        tasmSection = [
          'customSections',
          `${asset.name.replace(/\.css$/, '')}:CSS`,
        ]
        cssAssets.push(asset)
      }

      if (!tasmSection) continue
      compilation.updateAsset(asset.name, asset.source, {
        ...asset.info,
        ...(asset.info.assetType === 'javascript'
          ? { 'lynx:main-thread': isMainThread }
          : {}),
        'lynx:tasm-section': tasmSection,
      })
    }

    const customSections = this.#createAssetSections(
      compilation,
      mainThreadChunkNames,
      enableJsBytecode,
    )
    const chunkGroups = [...compilation.entrypoints.values()]
    const hooks = this.options.LynxTemplatePlugin.getLynxTemplatePluginHooks(
      compilation as unknown as Parameters<
        typeof this.options.LynxTemplatePlugin.getLynxTemplatePluginHooks
      >[0],
    )
    const intermediateAssets: string[] = []
    const beforeEncode = await hooks.beforeEncode.promise({
      encodeData: {
        compilerOptions,
        lepusCode: {
          root: undefined,
          chunks: [],
          filename: this.options.bundleFileName,
        },
        manifest: {},
        css: {
          chunks: [],
          cssMap: {},
          cssSource: {},
          contentMap: new Map(),
        },
        customSections,
        sourceContent: {
          dsl: 'external-bundle',
          appType: 'DynamicComponent',
          config: {},
        },
      },
      filenameTemplate: this.options.bundleFileName,
      chunkGroups: chunkGroups as unknown as Parameters<
        typeof hooks.beforeEncode.promise
      >[0]['chunkGroups'],
      intermediate: '',
      intermediateAssets,
    })

    const { lepusCode: _lepusCode, manifest: _manifest, css: _css, ...rest } =
      beforeEncode.encodeData
    const encodeOptions = {
      ...rest,
      lepusCode: undefined,
    }

    const result = await this.options.encode(encodeOptions)

    const beforeEmit = await hooks.beforeEmit.promise({
      finalEncodeOptions: encodeOptions,
      debugInfo: result.lepus_debug ?? '',
      ...(result.css_diagnostics === undefined
        ? {}
        : { cssDiagnostics: result.css_diagnostics }),
      template: result.buffer,
      outputName: this.options.bundleFileName,
      mainThreadAssets,
      cssChunks: cssAssets,
      chunkGroups: chunkGroups as unknown as Parameters<
        typeof hooks.beforeEmit.promise
      >[0]['chunkGroups'],
    })

    return {
      buffer: beforeEmit.template,
      encodeOptions,
      hooks,
    }
  }

  #createAssetSections(
    compilation: Rspack.Compilation,
    mainThreadChunkNames: Set<string>,
    enableJsBytecode: boolean,
  ): Record<string, {
    encoding?: 'JsBytecode' | 'CSS'
    content: string | { ruleList: LynxStyleNode[] }
  }> {
    return compilation.getAssets().reduce<
      Record<string, {
        encoding?: 'JsBytecode' | 'CSS'
        content: string | { ruleList: LynxStyleNode[] }
      }>
    >((sections, asset) => {
      if (asset.info.assetType === 'javascript') {
        const isMainThread = mainThreadChunkNames.has(asset.name)
        sections[asset.name.replace(/\.js$/, '')] = {
          ...(enableJsBytecode && isMainThread
            ? { encoding: 'JsBytecode' as const }
            : {}),
          content: asset.source.source().toString(),
        }
      } else if (asset.info.assetType === 'extract-css') {
        sections[`${asset.name.replace(/\.css$/, '')}:CSS`] = {
          encoding: 'CSS',
          content: {
            ruleList: cssChunksToMap(
              [asset.source.source().toString()],
              [],
              true,
            ).cssMap[0] ?? [],
          },
        }
      }
      return sections
    }, {})
  }
}
