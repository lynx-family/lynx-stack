// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

import { cssChunksToMap } from '@lynx-js/css-serializer'
import type { LynxStyleNode } from '@lynx-js/css-serializer'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

function sectionName(assetName: string, extension: string): string {
  return assetName.slice(assetName.lastIndexOf('/') + 1, -extension.length)
}

/**
 * Provides the template lifecycle hooks, so the plugins that tap them run for
 * a bundle assembled outside `LynxTemplatePlugin`.
 *
 * @public
 */
export interface LynxTemplatePluginHooksProvider {
  getLynxTemplatePluginHooks:
    typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
}

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
  encode: (opts: unknown) => { buffer: Buffer } | Promise<{ buffer: Buffer }>
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
   * Drives the template lifecycle hooks, so the plugins that tap them run for
   * an external bundle too.
   *
   * @remarks
   *
   * `pluginLynx` exposes this under `Symbol.for('LynxTemplatePlugin')`. Left
   * out, the bundle is assembled without running any of them.
   */
  LynxTemplatePlugin?: LynxTemplatePluginHooksProvider | undefined

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
    const hooks = this.options.LynxTemplatePlugin
      ?.getLynxTemplatePluginHooks(compilation)

    const { buffer, encodeOptions } = await this.#encode(
      assets,
      enableJsBytecode,
      compilation,
      hooks,
    )

    const { RawSource } = compiler.webpack.sources
    const outputName = this.options.bundleFileName

    const emitted = hooks
      ? await hooks.beforeEmit.promise({
        finalEncodeOptions: encodeOptions as never,
        debugInfo: '',
        template: buffer,
        outputName,
        mainThreadAssets: assets.filter(asset =>
          this.options.mainThreadChunks?.includes(asset.name)
        ) as never,
        cssChunks: assets.filter(asset =>
          asset.info.assetType === 'extract-css'
        ) as never,
        chunkGroups: [...compilation.chunkGroups] as never,
      })
      : undefined
    const template = emitted ? emitted.template : buffer

    compilation.emitAsset(
      outputName,
      new RawSource(template, false),
    )

    if (hooks) {
      await hooks.afterEmit.promise({ outputName })
    }
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
    assets: readonly Rspack.Asset[],
    enableJsBytecode: boolean,
    compilation: Rspack.Compilation,
    hooks:
      | ReturnType<
        LynxTemplatePluginHooksProvider['getLynxTemplatePluginHooks']
      >
      | undefined,
  ) {
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
                [sectionName(cur.name, '.js')]: {
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
                // A section is named after the entry it belongs to. The engine
                // emits CSS into a directory of its own, so the name is taken
                // from the file rather than from the path leading to it.
                [`${sectionName(cur.name, '.css')}:CSS`]: {
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

    if (!hooks) {
      const { buffer } = await this.options.encode(encodeOptions)
      return { buffer, encodeOptions }
    }

    // `beforeEncode` is where `pluginLynxDebugMetadata` collects the source
    // maps and rewrites the trailers, so it runs before the encoder does.
    // Every plugin that taps it reads the shape `LynxTemplatePlugin` builds,
    // so the sections are carried in one of that shape.
    const { encodeData } = await hooks.beforeEncode.promise({
      encodeData: {
        ...encodeOptions,
        sourceContent: { ...encodeOptions.sourceContent, config: {} },
        lepusCode: { chunks: [] },
        manifest: {},
        css: {},
      } as never,
      filenameTemplate: this.options.bundleFileName,
      chunkGroups: [...compilation.chunkGroups] as never,
      intermediate: '',
      intermediateAssets: [],
    })

    const resolved = encodeData as unknown as typeof encodeOptions & {
      sourceContent: { config?: Record<string, unknown> }
    }
    const { config, ...sourceContent } = resolved.sourceContent

    // An external bundle carries no `lepusCode`, `manifest` or `css`: its
    // chunks are sections. They were only there for the hooks, so encode
    // what it actually carries, keeping whatever a tap wrote.
    const forEncode = {
      compilerOptions: resolved.compilerOptions,
      sourceContent: config && Object.keys(config).length > 0
        ? { ...sourceContent, config }
        : sourceContent,
      customSections: resolved.customSections,
    } as typeof encodeOptions

    const { buffer } = await this.options.encode(forEncode)

    return { buffer, encodeOptions: forEncode }
  }
}
