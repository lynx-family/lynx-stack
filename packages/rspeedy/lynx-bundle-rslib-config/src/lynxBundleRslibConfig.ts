// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LibConfig, RslibConfig, Rspack, rsbuild } from '@rslib/core'

import { RuntimeWrapperWebpackPlugin as BackgroundRuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'

import { LazyBundleWebpackPlugin } from './webpack/LazyBundleWebpackPlugin.js'
import { MainThreadRuntimeWrapperWebpackPlugin } from './webpack/MainThreadRuntimeWrapperWebpackPlugin.js'

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
  },
  shims: {
    cjs: {
      // Don't inject shim because Lynx don't support.
      'import.meta.url': false,
    },
  },
}

/**
 * The default rsbuild config{@link LibConfig} for external bundle.
 *
 * @public
 */
export const defaultExternalBundleRsbuildConfig: RslibConfig['lib'][0] = {
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
  tools: {
    bundlerChain: (chain) => {
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
      // dprint-ignore
      chain
        .plugin(MainThreadRuntimeWrapperWebpackPlugin.name)
        .use(MainThreadRuntimeWrapperWebpackPlugin, [{
          test: mainThreadEntryName.map((name) => new RegExp(`${name}\\.js$`)),
        }])
        .end()
        .plugin(BackgroundRuntimeWrapperWebpackPlugin.name)
        .use(BackgroundRuntimeWrapperWebpackPlugin, [{
          test: backgroundEntryName.map((name) => new RegExp(`${name}\\.js$`)),
        }])
        .end()
    },
  },
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
 * import { defineExternalBundleRslibConfig, LAYERS } from '@lynx-js/lynx-bundle-rslib-config'
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
  userLibConfig: LibConfig,
): RslibConfig {
  return {
    lib: [
      {
        ...defaultExternalBundleLibConfig,
        ...userLibConfig,
      },
    ],
    ...defaultExternalBundleRsbuildConfig,
    plugins: [
      lazyBundleRsbuildPlugin(),
    ],
  }
}

const lazyBundleRsbuildPlugin = (): rsbuild.RsbuildPlugin => ({
  name: 'lynx:lazy-bundle',
  async setup(api) {
    const { getEncodeMode } = await import('@lynx-js/tasm')

    api.modifyBundlerChain((chain, { environment: { name: libName } }) => {
      // dprint-ignore
      chain
        .plugin(LazyBundleWebpackPlugin.name)
        .use(
          LazyBundleWebpackPlugin,
          [
            { 
              templateFileName: `${libName}.lynx.bundle`,
              encode: getEncodeMode(),
            },
          ],
        )
        .end()
    })
  },
})
