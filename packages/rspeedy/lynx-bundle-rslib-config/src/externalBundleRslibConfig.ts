// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { rsbuild } from '@rslib/core'
import type { LibConfig, RslibConfig, Rspack } from '@rslib/core'

import { RuntimeWrapperWebpackPlugin as BackgroundRuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'

import { ExternalBundleWebpackPlugin } from './webpack/ExternalBundleWebpackPlugin.js'
import { MainThreadRuntimeWrapperWebpackPlugin } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'

/**
 * The options for encoding the external bundle.
 *
 * @public
 */
export interface EncodeOptions {
  /**
   * The target SDK version of the external bundle.
   *
   * @defaultValue '3.4'
   */
  targetSdkVersion?: string
}

/**
 * The Layer name of background and main-thread.
 *
 * @public
 */
export const LAYERS = {
  BACKGROUND: 'background',
  MAIN_THREAD: 'main-thread',
} as const

/**
 * The default lib config{@link LibConfig} for external bundle.
 *
 * @public
 */
export const defaultExternalBundleLibConfig: LibConfig = {
  format: 'cjs',
  syntax: 'es2015',
  autoExtension: false,
  autoExternal: {
    dependencies: false,
    peerDependencies: false,
  },
  shims: {
    cjs: {
      // Don't inject shim because Lynx don't support.
      'import.meta.url': false,
    },
  },
  output: {
    minify: {
      jsOptions: {
        minimizerOptions: {
          compress: {
            /**
             * the module wrapper iife need to be kept to provide the return value
             * for the module loader in lynx_core.js
             */
            negate_iife: false,
            // Allow return in module wrapper
            side_effects: false,
          },
        },
      },
    },
  },
  source: {
    include: [/node_modules/],
  },
}

type Externals = Record<string, string | string[]>

type LibOutputConfig = Required<LibConfig>['output']

interface OutputConfig extends LibOutputConfig {
  externals?: Externals
}

interface ExternalBundleLibConfig extends LibConfig {
  output?: OutputConfig
}

function transformExternals(
  externals?: Externals,
): Required<LibOutputConfig>['externals'] {
  if (!externals) return {}

  return function({ request, contextInfo }, callback) {
    if (!request) return callback()
    const libraryName = externals[request]
    if (!libraryName) return callback()

    if (contextInfo?.issuerLayer === LAYERS.MAIN_THREAD) {
      callback(undefined, [
        'globalThis',
        'lynx_ex',
        ...(Array.isArray(libraryName) ? libraryName : [libraryName]),
      ], 'var')
    } else {
      callback(undefined, [
        'lynxCoreInject',
        'tt',
        'lynx_ex',
        ...(Array.isArray(libraryName) ? libraryName : [libraryName]),
      ], 'var')
    }
  }
}

/**
 * Get the rslib config for building Lynx external bundles.
 *
 * @public
 *
 * @example
 *
 * If you want to build an external bundle which use in Lynx background thread, you can use the following code:
 *
 * ```js
 * // rslib.config.js
 * import { defineExternalBundleRslibConfig, LAYERS } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'utils-lib',
 *   source: {
 *     entry: {
 *       utils: {
 *         import: './src/utils.ts',
 *         layer: LAYERS.BACKGROUND,
 *       }
 *     }
 *   }
 * })
 * ```
 *
 * Then you can use `lynx.loadScript('utils', { bundleName: 'utils-lib-bundle-url' })` in background thread.
 *
 * @example
 *
 * If you want to build an external bundle which use in Lynx main thread, you can use the following code:
 *
 * ```js
 * // rslib.config.js
 * import { defineExternalBundleRslibConfig, LAYERS } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'utils-lib',
 *   source: {
 *     entry: {
 *       utils: {
 *         import: './src/utils.ts',
 *         layer: LAYERS.MAIN_THREAD,
 *       }
 *     }
 *   }
 * })
 * ```
 * Then you can use `lynx.loadScript('utils', { bundleName: 'utils-lib-bundle-url' })` in main-thread.
 *
 * @example
 *
 * If you want to build an external bundle which use both in Lynx main thread and background thread. You don't need to set the layer.
 *
 * ```js
 * // rslib.config.js
 * import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'utils-lib',
 *   source: {
 *     entry: {
 *       utils: './src/utils.ts',
 *     },
 *   }
 * })
 * ```
 *
 * Then you can use `lynx.loadScript('utils', { bundleName: 'utils-lib-bundle-url' })` in background thread and `lynx.loadScript('utils__main-thread', { bundleName: 'utils-lib-bundle-url' })` in main-thread.
 */
export function defineExternalBundleRslibConfig(
  userLibConfig: ExternalBundleLibConfig,
  encodeOptions: EncodeOptions = {},
): RslibConfig {
  return {
    lib: [
      // eslint-disable-next-line import/namespace
      rsbuild.mergeRsbuildConfig<LibConfig>(
        defaultExternalBundleLibConfig,
        {
          ...userLibConfig,
          output: {
            ...userLibConfig.output,
            externals: transformExternals(userLibConfig.output?.externals),
          },
        },
      ),
    ],
    plugins: [
      externalBundleEntryRsbuildPlugin(),
      externalBundleRsbuildPlugin(encodeOptions.targetSdkVersion),
    ],
  }
}

const externalBundleEntryRsbuildPlugin = (): rsbuild.RsbuildPlugin => ({
  name: 'lynx:external-bundle-entry',
  setup(api) {
    api.modifyBundlerChain((chain) => {
      // copy entries
      const entries = chain.entryPoints.entries() ?? {}

      chain.entryPoints.clear()

      const backgroundEntryName: string[] = []
      const mainThreadEntryName: string[] = []

      const addLayeredEntry = (
        entryName: string,
        entryValue: Rspack.EntryDescription,
      ) => {
        chain
          .entry(entryName)
          .add(entryValue)
          .end()
      }

      Object.entries(entries).forEach(([entryName, entryPoint]) => {
        const entryPointValue = entryPoint.values()

        for (const value of entryPointValue) {
          if (typeof value === 'string' || Array.isArray(value)) {
            const mainThreadEntry = `${entryName}__main-thread`
            const backgroundEntry = entryName
            mainThreadEntryName.push(mainThreadEntry)
            backgroundEntryName.push(backgroundEntry)
            addLayeredEntry(mainThreadEntry, {
              import: value,
              layer: LAYERS.MAIN_THREAD,
            })
            addLayeredEntry(backgroundEntry, {
              import: value,
              layer: LAYERS.BACKGROUND,
            })
          } else {
            // object
            const { layer } = value
            if (layer === LAYERS.MAIN_THREAD) {
              mainThreadEntryName.push(entryName)
              addLayeredEntry(entryName, {
                ...value,
                layer: LAYERS.MAIN_THREAD,
              })
            } else if (layer === LAYERS.BACKGROUND) {
              backgroundEntryName.push(entryName)
              addLayeredEntry(entryName, { ...value, layer: LAYERS.BACKGROUND })
            } else {
              // not specify layer
              const mainThreadEntry = `${entryName}__main-thread`
              const backgroundEntry = entryName
              mainThreadEntryName.push(mainThreadEntry)
              backgroundEntryName.push(backgroundEntry)
              addLayeredEntry(mainThreadEntry, {
                ...value,
                layer: LAYERS.MAIN_THREAD,
              })
              addLayeredEntry(backgroundEntry, {
                ...value,
                layer: LAYERS.BACKGROUND,
              })
            }
          }
        }
      })
      // add external bundle wrapper
      // dprint-ignore
      chain
        .plugin(MainThreadRuntimeWrapperWebpackPlugin.name)
        .use(MainThreadRuntimeWrapperWebpackPlugin, [{
          test: mainThreadEntryName.map((name) => new RegExp(`${escapeRegex(name)}\\.js$`)),
        }])
        .end()
        .plugin(BackgroundRuntimeWrapperWebpackPlugin.name)
        .use(BackgroundRuntimeWrapperWebpackPlugin, [{
          test: backgroundEntryName.map((name) => new RegExp(`${escapeRegex(name)}\\.js$`)),
        }])
        .end()
    })
  },
})

const externalBundleRsbuildPlugin = (
  targetSdkVersion: string | undefined,
): rsbuild.RsbuildPlugin => ({
  name: 'lynx:gen-external-bundle',
  async setup(api) {
    const { getEncodeMode } = await import('@lynx-js/tasm')

    api.modifyBundlerChain((chain, { environment: { name: libName } }) => {
      // dprint-ignore
      chain
        .plugin(ExternalBundleWebpackPlugin.name)
        .use(
          ExternalBundleWebpackPlugin,
          [
            { 
              bundleFileName: `${libName}.lynx.bundle`,
              encode: getEncodeMode(),
              targetSdkVersion,
            },
          ],
        )
        .end()
    })
  },
})

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
