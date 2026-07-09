// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin, Rspack, RspackChain } from '@rsbuild/core'
import invariant from 'tiny-invariant'
import type { UndefinedOnPartialDeep } from 'type-fest'

import { isLynx } from '../utils/is-lynx.js'
import { EvalSourceMapDevToolPlugin } from '../webpack/EvalSourceMapDevToolPlugin.js'
import { SourceMapDevToolPlugin } from '../webpack/SourceMapDevToolPlugin.js'

export function pluginSourcemap(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:sourcemap',
    pre: ['lynx:rsbuild:dev'],
    setup(api) {
      api.modifyBundlerChain((chain, { isDev, environment }) => {
        const { dev, output, server } = api.getRsbuildConfig('current')

        const publicPath = isDev ? dev?.assetPrefix : output?.assetPrefix

        if (publicPath === false) {
          // `dev.assetPrefix === false`
          // We do not modify the devtool option and keep the default
          // sibling `.map` files reachable from their `sourceMappingURL`
          // trailer.
          return
        }

        // If `dev.assetPrefix === true`, it should have been replaced by the `lynx:rsbuild:dev` plugin.
        invariant(
          typeof publicPath === 'string' || publicPath === undefined,
          `dev.assetPrefix should be normalized to string, got ${dev?.assetPrefix}`,
        )

        applySourceMapPlugin(
          chain,
          getDevtoolFromSourceMap(),
          publicPath?.replaceAll(
            '<port>',
            String(api.context.devServer?.port ?? server?.port),
          ),
        )

        if (isLynx(environment)) {
          applyDropSourceMapAssets(chain)
        }

        function getDevtoolFromSourceMap(): Rspack.DevTool {
          const DEFAULT_DEV_DEVTOOL = 'cheap-module-source-map'

          switch (typeof output?.sourceMap) {
            case 'boolean': {
              if (output.sourceMap) {
                return isDev ? DEFAULT_DEV_DEVTOOL : 'source-map'
              } else {
                return false
              }
            }
            case 'undefined':
            case 'object': {
              return output?.sourceMap?.js
                ?? (isDev
                  ? DEFAULT_DEV_DEVTOOL
                  : (isLynx(environment) ? 'source-map' : false))
            }
          }
        }
      })
    },
  }
}

function applyDropSourceMapAssets(chain: RspackChain): void {
  chain
    .plugin('lynx:sourcemap-drop')
    .use(
      class DropSourceMapAssetsPlugin {
        apply(compiler: Rspack.Compiler): void {
          const { Compilation } = compiler.webpack
          compiler.hooks.compilation.tap(
            'LynxDropSourceMapAssetsPlugin',
            (compilation) => {
              compilation.hooks.processAssets.tap(
                {
                  name: 'LynxDropSourceMapAssetsPlugin',
                  stage: Compilation.PROCESS_ASSETS_STAGE_REPORT + 1,
                },
                () => {
                  for (const name of Object.keys(compilation.assets)) {
                    if (name.endsWith('.map')) {
                      compilation.deleteAsset(name)
                    }
                  }
                },
              )
            },
          )
        }
      },
      [],
    )
}

function applySourceMapPlugin(
  chain: RspackChain,
  devtool: Rspack.DevTool,
  publicPath: string | undefined,
): void {
  if (devtool === false) {
    return
  }

  const CHAIN_ID_DEV_SOURCEMAP = 'lynx:sourcemap'

  const output = chain.get('output') as Rspack.Output | undefined

  if (devtool.includes('source-map')) {
    const hidden = devtool.includes('hidden')
    const inline = devtool.includes('inline')
    const evalWrapped = devtool.includes('eval')
    const cheap = devtool.includes('cheap')
    const moduleMaps = devtool.includes('module')
    const noSources = devtool.includes('nosources')
    const debugIds = devtool.includes('debugids')

    const options = {
      filename: inline
        ? null
        : (output?.sourceMapFilename ?? '[file].map[query]'),
      moduleFilenameTemplate: output?.devtoolModuleFilenameTemplate
        ?? 'file://[absolute-resource-path]',
      fallbackModuleFilenameTemplate: output
        ?.devtoolFallbackModuleFilenameTemplate
        ?? 'file://[absolute-resource-path]?[hash]',
      append: hidden ? false : undefined,
      module: moduleMaps ? true : !cheap,
      columns: !cheap,
      noSources,
      namespace: output?.devtoolNamespace,
      publicPath,
      debugIds,
    } satisfies UndefinedOnPartialDeep<Rspack.SourceMapDevToolPluginOptions>

    chain
      // If you want to use a custom configuration for this plugin in development mode
      // Make sure to disable the default one. I.e. set `devtool: false`.
      // See: https://webpack.js.org/plugins/source-map-dev-tool-plugin/
      .devtool(false)
      .plugin(CHAIN_ID_DEV_SOURCEMAP)
      .when(
        evalWrapped,
        plugin =>
          plugin.use(EvalSourceMapDevToolPlugin, [
            options as Rspack.SourceMapDevToolPluginOptions,
          ]),
        plugin =>
          plugin.use(SourceMapDevToolPlugin, [
            options as Rspack.SourceMapDevToolPluginOptions,
          ]),
      )
  }
}
