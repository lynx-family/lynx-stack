// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'

import type {
  NormalizedEnvironmentConfig,
  RsbuildPluginAPI,
  Rspack,
} from '@rsbuild/core'
import type { UndefinedOnPartialDeep } from 'type-fest'

// Import the mock Vue webpack plugin instead of the actual one
import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'
import type { ExposedAPI } from '@lynx-js/rspeedy'
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  CSSPlugins,
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'
import { LAYERS, VueWebpackPlugin } from '@lynx-js/vue-webpack-plugin'

import type { PluginVueLynxOptions } from './pluginVueLynx.js'

const PLUGIN_NAME_VUE = 'lynx:vue'
const PLUGIN_NAME_TEMPLATE = 'lynx:template'
const PLUGIN_NAME_RUNTIME_WRAPPER = 'lynx:runtime-wrapper'
const PLUGIN_NAME_CSS_EXTRACT = 'lynx:css-extract'
const PLUGIN_NAME_WEB = 'lynx:web'

const DEFAULT_DIST_PATH_INTERMEDIATE = '.rspeedy'
const DEFAULT_FILENAME_HASH = '.[contenthash:8]'
const EMPTY_HASH = ''

export function applyEntry(
  api: RsbuildPluginAPI,
  options: Required<PluginVueLynxOptions>,
): void {
  const {
    customCSSInheritanceList,
    debugInfoOutside,
    defaultDisplayLinear,
    enableAccessibilityElement,
    enableICU,
    enableCSSInheritance,
    enableCSSInvalidation,
    enableCSSSelector,
    enableNewGesture,
    enableParallelElement,
    enableRemoveCSSScope,
    pipelineSchedulerConfig,
    removeDescendantSelectorScope,
    targetSdkVersion,
    experimental_isLazyBundle,
  } = options

  const { config } = api.useExposed<ExposedAPI>(
    Symbol.for('rspeedy.api'),
  )!

  api.modifyBundlerChain(async (chain, { environment, isDev, isProd }) => {
    const entries = chain.entryPoints.entries() ?? {}
    const isLynx = environment.name === 'lynx'
    const isWeb = environment.name === 'web'

    chain.entryPoints.clear()

    const mainThreadChunks: string[] = []

    Object.entries(entries).forEach(([entryName, entryPoint]) => {
      const { imports } = getChunks(entryName, entryPoint.values())

      const templateFilename = (
        typeof config.output?.filename === 'object'
          ? config.output.filename.bundle ?? config.output.filename.template
          : config.output?.filename
      ) ?? '[name].[platform].bundle'

      const mainThreadEntry = `${entryName}__main-thread`
      const mainThreadName = path.posix.join(
        isLynx ? DEFAULT_DIST_PATH_INTERMEDIATE : '',
        `${entryName}/main-thread.js`,
      )

      const backgroundName = path.posix.join(
        isLynx ? DEFAULT_DIST_PATH_INTERMEDIATE : '',
        getBackgroundFilename(
          entryName,
          environment.config,
          isProd,
          experimental_isLazyBundle,
        ),
      )

      const backgroundEntry = entryName

      mainThreadChunks.push(mainThreadName)

      chain
        .entry(mainThreadEntry)
        .add({
          layer: LAYERS.MAIN_THREAD,
          import: imports,
          filename: mainThreadName,
        })
        .when(isDev && !isWeb, entry => {
          const require = createRequire(import.meta.url)
          entry
            .prepend({
              layer: LAYERS.MAIN_THREAD,
              import: require.resolve(
                '@lynx-js/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs',
              ),
            })
        })
        .end()
        .entry(backgroundEntry)
        .add({
          layer: LAYERS.BACKGROUND,
          import: imports,
          filename: backgroundName,
        })
        .when(isDev && !isWeb, entry => {
          entry
            .prepend({
              layer: LAYERS.BACKGROUND,
              import: '@rspack/core/hot/dev-server',
            })
            .prepend({
              layer: LAYERS.BACKGROUND,
              import: '@lynx-js/webpack-dev-transport/client',
            })
            .prepend({
              layer: LAYERS.BACKGROUND,
              import: '@lynx-js/vue/hmr',
            })
        })
        .end()
        .plugin(`${PLUGIN_NAME_TEMPLATE}-${entryName}`)
        .use(LynxTemplatePlugin, [{
          dsl: 'react_nodiff',
          chunks: [mainThreadEntry, backgroundEntry],
          filename: templateFilename.replaceAll('[name]', entryName).replaceAll(
            '[platform]',
            environment.name,
          ),
          intermediate: path.posix.join(
            DEFAULT_DIST_PATH_INTERMEDIATE,
            entryName,
          ),
          customCSSInheritanceList,
          debugInfoOutside,
          defaultDisplayLinear,
          enableA11y: true,
          enableAccessibilityElement,
          enableICU,
          enableCSSInheritance,
          enableCSSInvalidation,
          enableCSSSelector,
          enableNewGesture,
          enableParallelElement,
          enableRemoveCSSScope: enableRemoveCSSScope ?? true,
          pipelineSchedulerConfig,
          removeDescendantSelectorScope,
          targetSdkVersion,
          experimental_isLazyBundle,
          cssPlugins: [
            CSSPlugins.parserPlugins.removeFunctionWhiteSpace(),
          ],
        }])
        .end()
        .plugin(`${PLUGIN_NAME_CSS_EXTRACT}-${entryName}`)
        .use(CssExtractWebpackPlugin, [{
          filename: '[name]/style.css',
          chunkFilename: '[name]/[id].css',
          layers: [LAYERS.MAIN_THREAD],
          ignoreOrder: false,
          experimentalUseImportModule: false,
        }])
        .end()
        .plugin(`${PLUGIN_NAME_RUNTIME_WRAPPER}-${entryName}`)
        .use(RuntimeWrapperWebpackPlugin, [{
          injectVars(vars) {
            return Object.assign(vars, {
              __TEMPLATE_PATH__: JSON.stringify(
                templateFilename
                  .replaceAll('[name]', entryName)
                  .replaceAll('[platform]', environment.name),
              ),
            })
          },
          targetSdkVersion,
          test: /^(?!.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$).*\.js$/,
        }])
        .end()
    })

    const rsbuildConfig = api.getRsbuildConfig()

    const enableChunkSplitting =
      rsbuildConfig.performance?.chunkSplit?.strategy !== 'all-in-one'

    if (isLynx) {
      let inlineScripts
      if (experimental_isLazyBundle) {
        inlineScripts = true
      } else {
        inlineScripts = environment.config.output?.inlineScripts
          ?? !enableChunkSplitting
      }

      chain
        .plugin(`${LynxEncodePlugin.name}`)
        .use(LynxEncodePlugin, [{ inlineScripts }])
        .end()
    }

    if (isWeb) {
      chain
        .plugin(PLUGIN_NAME_WEB)
        .use(WebEncodePlugin, [])
        .end()
    }

    chain
      .plugin(PLUGIN_NAME_VUE)
      .after(PLUGIN_NAME_TEMPLATE)
      .use(VueWebpackPlugin, [{
        mainThreadChunks,
        isProduction: isProd,
        experimental_isLazyBundle,
      }])
  })
}

/**
 * Get the chunks and imports for an entry
 */
function getChunks(
  entryName: string,
  entryValue:
    (string | string[] | UndefinedOnPartialDeep<Rspack.EntryDescription>)[],
): { chunks: string[], imports: string[] } {
  const chunks = [entryName]
  const imports: string[] = []

  for (const item of entryValue) {
    if (typeof item === 'string') {
      imports.push(item)
      continue
    }

    if (Array.isArray(item)) {
      imports.push(...item)
      continue
    }

    const { dependOn } = item

    if (Array.isArray(item.import)) {
      imports.push(...item.import)
    } else {
      imports.push(item.import)
    }

    if (!dependOn) {
      continue
    }

    if (typeof dependOn === 'string') {
      chunks.unshift(dependOn)
    } else {
      chunks.unshift(...dependOn)
    }
  }

  return { chunks, imports }
}

/**
 * Get the background filename
 */
function getBackgroundFilename(
  entryName: string,
  config: NormalizedEnvironmentConfig,
  isProd: boolean,
  experimental_isLazyBundle: boolean,
): string {
  const { filename } = config.output

  if (typeof filename.js === 'string') {
    return filename.js
      .replaceAll('[name]', entryName)
      .replaceAll('.js', '/background.js')
  } else {
    return `${entryName}/background${
      getHash(config, isProd, experimental_isLazyBundle)
    }.js`
  }
}

/**
 * Get the hash configuration
 */
function getHash(
  config: NormalizedEnvironmentConfig,
  isProd: boolean,
  experimental_isLazyBundle: boolean,
): string {
  if (typeof config.output?.filenameHash === 'string') {
    return config.output.filenameHash
      ? `.[${config.output.filenameHash}]`
      : EMPTY_HASH
  } else if (config.output?.filenameHash === false) {
    return EMPTY_HASH
  } else if (isProd || experimental_isLazyBundle) {
    return DEFAULT_FILENAME_HASH
  } else {
    return EMPTY_HASH
  }
}
