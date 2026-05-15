// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Asset, Compilation, Compiler } from 'webpack'

import { cssChunksToMap } from '@lynx-js/css-serializer'
import type { LynxStyleNode } from '@lynx-js/css-serializer'
import { processTasmCSSDiagnostics } from '@lynx-js/template-webpack-plugin'

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
  encode: (opts: unknown) => Promise<{
    buffer: Buffer
    css_diagnostics?: unknown
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
        const emittedCSSDiagnosticWarnings = new Set<string>()

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
              emittedCSSDiagnosticWarnings,
            )
          },
        )
      },
    )
  }

  async #generateExternalBundle(
    compiler: Compiler,
    compilation: Compilation,
    emittedCSSDiagnosticWarnings: Set<string>,
  ): Promise<void> {
    const assets = compilation.getAssets()
    const { buffer, encodeOptions, cssDiagnostics } = await this.#encode(assets)

    const resolvedDiagnostics = processTasmCSSDiagnostics({
      cssDiagnostics,
      cssSourceMaps: collectCSSSourceMapContents(assets),
      context: compiler.context,
      emittedWarnings: emittedCSSDiagnosticWarnings,
    })
    resolvedDiagnostics.forEach((diagnostic) => {
      const webpackWarning = new compiler.webpack.WebpackError(
        diagnostic.message,
      )
      webpackWarning.hideStack = true

      if (
        diagnostic.sourceFile
        && diagnostic.sourceLine !== undefined
        && diagnostic.sourceColumn !== undefined
      ) {
        webpackWarning.file = diagnostic.sourceFile
        webpackWarning.loc = {
          start: {
            line: diagnostic.sourceLine,
            column: diagnostic.sourceColumn,
          },
        }
      } else {
        webpackWarning.loc = {
          start: {
            line: diagnostic.line,
            column: diagnostic.column,
          },
        }
      }

      compilation.warnings.push(webpackWarning)
    })

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
                  ...(this.options.mainThreadChunks?.includes(cur.name)
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

    const { buffer, css_diagnostics } = await this.options.encode(encodeOptions)

    return { buffer, encodeOptions, cssDiagnostics: css_diagnostics }
  }
}

function collectCSSSourceMapContents(
  assets: Readonly<Asset>[],
): string[] {
  const sourceMaps = assets.reduce<string[]>((result, asset) => {
    if (asset.info['assetType'] !== 'extract-css') {
      return result
    }

    const sourceMap = asset.source.map?.()
    if (!sourceMap || Array.isArray(sourceMap)) {
      return result
    }

    result.push(JSON.stringify(sourceMap))
    return result
  }, [])

  return Array.from(new Set(sourceMaps))
}
