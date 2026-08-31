// Copyright 2024 The Lynx Authors. All rights reserved.
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

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
import type { LynxConfig } from '@lynx-js/rsbuild-plugin'
import type { ExposedAPI } from '@lynx-js/rspeedy'
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'
import { resolveLazyBundleFetcher } from './resolveLazyBundleFetcher.js'

const S_LYNX_CONFIG = Symbol.for('@lynx-js/rsbuild-plugin:config')

const PLUGIN_NAME_REACT = 'lynx:react'
const PLUGIN_NAME_TEMPLATE = 'lynx:template'
const PLUGIN_NAME_RUNTIME_WRAPPER = 'lynx:runtime-wrapper'
const PLUGIN_NAME_WEB = 'lynx:web'

const DEFAULT_FILENAME_HASH = '.[contenthash:8]'
const EMPTY_HASH = ''

export function applyEntry(
  api: RsbuildPluginAPI,
  options: Required<PluginReactLynxOptions>,
): void {
  const {
    compat,
    customCSSInheritanceList,
    debugInfoOutside,
    defaultDisplayLinear,
    enableAccessibilityElement,
    enableCSSInheritance,
    enableCSSInvalidation,
    enableCSSSelector,
    enableNewGesture,
    enableRemoveCSSScope,
    firstScreenSyncTiming,
    globalPropsMode,
    enableSSR,
    removeDescendantSelectorScope,
    targetSdkVersion,
    extractStr: originalExtractStr,

    experimental_isLazyBundle,
    experimental_transformBuiltinAttributeNames,
  } = options

  const lazyBundleFetcher = resolveLazyBundleFetcher(targetSdkVersion)

  api.modifyBundlerChain(async (chain, { environment, isDev, isProd }) => {
    const mainThreadChunks: string[] = []
    const entryPairs: Array<{ mainThread: string, background: string }> = []

    const rsbuildConfig = api.getRsbuildConfig()
    const userConfig = api.getRsbuildConfig('original')
    const chunkSplitStrategy = userConfig.performance?.chunkSplit?.strategy
    const enableChunkSplitting = userConfig.splitChunks === undefined
      ? (chunkSplitStrategy
        ? chunkSplitStrategy !== 'all-in-one'
        : rsbuildConfig.splitChunks !== false)
      : rsbuildConfig.splitChunks !== false
    const rspeedyConfig = api.context.callerName === 'rspeedy'
      // biome-ignore lint/correctness/useHookAtTopLevel: This is not a React hook.
      ? api.useExposed<ExposedAPI>(Symbol.for('rspeedy.api'))?.config
      : undefined

    // biome-ignore lint/correctness/useHookAtTopLevel: This is not a React hook.
    const lynxConfig = api.useExposed<LynxConfig>(S_LYNX_CONFIG)

    // An external bundle assembles its own template and a test run has none,
    // so the entries and template plugins below are an application's.
    const isApplication = api.context.callerName !== 'rslib'
      && api.context.callerName !== 'rstest'
    if (isApplication) {
      if (!lynxConfig) {
        throw new Error(
          'No Lynx config exposed. `pluginLynx` has to be applied for the Lynx build engine to be configured.',
        )
      }

      const entries = chain.entryPoints.entries() ?? {}
      const isLynx = environment.name === 'lynx'
        || environment.name.startsWith('lynx-')
      const isWeb = environment.name === 'web'
        || environment.name.startsWith('web-')
      const { hmr, liveReload } = environment.config.dev ?? {}
      const enabledHMR = isDev && hmr !== false
      const enabledLiveReload = isDev && liveReload !== false

      chain.entryPoints.clear()

      Object.entries(entries).forEach(([entryName, entryPoint]) => {
        const { imports } = getChunks(entryName, entryPoint.values())

        const templateFilename = lynxConfig.resolveBundleFilename({
          entryName,
          platform: environment.name,
        })

        // `lazyBundleFilename` is only set when `bundle` is a function.
        // Otherwise `LynxTemplatePlugin` keeps its default
        // (`lazy-bundle/[name].[fullhash].bundle`).
        const lazyBundleFilename = lynxConfig.resolveLazyBundleFilename({
          platform: environment.name,
        })

        // We do not use `${entryName}__background` since the default CSS name is `[name]/[name].css`.
        // We would like to avoid adding `__background` to the output CSS filename.
        const mainThreadEntry = `${entryName}__main-thread`

        const mainThreadName = path.posix.join(
          isLynx
            ? lynxConfig.resolveIntermediateDir()
            // For non-Lynx environment, the entry is not deleted.
            // So we do not put it in the intermediate.
            : '',
          `${entryName}/main-thread.js`,
        )

        const backgroundName = path.posix.join(
          isLynx
            ? lynxConfig.resolveIntermediateDir()
            // For non-Lynx environment, the entry is not deleted.
            // So we do not put it in the intermediate.
            : '',
          getBackgroundFilename(
            entryName,
            environment.config,
            isProd,
            experimental_isLazyBundle,
          ),
        )

        const backgroundEntry = entryName

        mainThreadChunks.push(mainThreadName)

        entryPairs.push({
          mainThread: mainThreadEntry,
          background: backgroundEntry,
        })

        chain
          .entry(mainThreadEntry)
          .add({
            layer: LAYERS.MAIN_THREAD,
            import: imports,
            filename: mainThreadName,
          })
          .when(enabledHMR, entry => {
            const require = createRequire(import.meta.url)
            // use prepend to make sure it does not affect the exports
            // from the entry
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
          // in standalone lazy bundle mode, we do not add
          // other entries to avoid wrongly exporting from other entries
          .when(enabledHMR, entry => {
            // use prepend to make sure it does not affect the exports
            // from the entry
            entry
              // This is aliased in `@lynx-js/rspeedy`
              .prepend({
                layer: LAYERS.BACKGROUND,
                import: '@rspack/core/hot/dev-server',
              })
              // This is aliased in `./refresh.ts`
              .prepend({
                layer: LAYERS.BACKGROUND,
                import: '@lynx-js/react/refresh',
              })
          })
          .when(enabledHMR || enabledLiveReload, entry => {
            // This is aliased in `@lynx-js/rspeedy`
            entry
              .prepend({
                layer: LAYERS.BACKGROUND,
                import: '@lynx-js/webpack-dev-transport/client',
              })
          })
          .end()
          .plugin(`${PLUGIN_NAME_TEMPLATE}-${entryName}`)
          .use(LynxTemplatePlugin, [{
            dsl: 'react_nodiff',
            chunks: [mainThreadEntry, backgroundEntry],
            filename: templateFilename,
            ...(lazyBundleFilename ? { lazyBundleFilename } : {}),
            intermediate: lynxConfig.resolveIntermediateDir({ entryName }),
            customCSSInheritanceList,
            debugInfoOutside,
            defaultDisplayLinear,
            enableA11y: true,
            enableAccessibilityElement,
            enableCSSInheritance,
            enableCSSInvalidation,
            enableCSSSelector,
            enableNewGesture,
            enableRemoveCSSScope: enableRemoveCSSScope ?? true,
            removeDescendantSelectorScope,
            targetSdkVersion,

            experimental_isLazyBundle,
            lazyBundleFetcher,
            cssPlugins: [],
          }])
          .end()
      })

      if (isLynx) {
        let inlineScripts
        if (experimental_isLazyBundle) {
          // TODO: support inlineScripts in lazyBundle
          inlineScripts = true
        } else {
          inlineScripts = environment.config.output?.inlineScripts
            ?? !enableChunkSplitting
        }

        chain
          .plugin(PLUGIN_NAME_RUNTIME_WRAPPER)
          .use(RuntimeWrapperWebpackPlugin, [{
            injectVars(vars) {
              const UNUSED_VARS = new Set([
                'Card',
                'Component',
                'ReactLynx',
                'Behavior',
              ])
              return vars.map(name => {
                if (UNUSED_VARS.has(name)) {
                  return `__${name}`
                }
                return name
              })
            },
            targetSdkVersion,
            // Inject runtime wrapper for all `.js` but not `main-thread.js` and `main-thread.[hash].js`.
            test: /^(?!.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$).*\.js$/,
            experimental_isLazyBundle,
          }])
          .end()
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
    }

    let extractStr = originalExtractStr
    if (enableChunkSplitting && originalExtractStr) {
      ;(api.logger ?? console).warn(
        '`extractStr` is changed to `false` because it is only supported when chunk splitting is disabled, please set `splitChunks` to `false` to use `extractStr.`',
      )
      extractStr = false
    }

    const { resolve } = api.useExposed<
      { resolve: (request: string) => Promise<string> }
    >(Symbol.for('@lynx-js/react/internal:resolve'))!

    chain
      .plugin(PLUGIN_NAME_REACT)
      .after(PLUGIN_NAME_TEMPLATE)
      .use(ReactWebpackPlugin, [{
        disableCreateSelectorQueryIncompatibleWarning: compat
          ?.disableCreateSelectorQueryIncompatibleWarning ?? false,
        firstScreenSyncTiming,
        globalPropsMode,
        enableSSR,
        mainThreadChunks,
        entryPairs,
        extractStr,
        experimental_isLazyBundle,
        experimental_useElementTemplate:
          options.experimental_useElementTemplate,
        experimental_transformBuiltinAttributeNames,
        profile: getDefaultProfile(),
        workletRuntimePath: await resolve(
          `@lynx-js/react/${isDev ? 'worklet-dev-runtime' : 'worklet-runtime'}`,
        ),
        lazyBundleFetcher,
      }])

    function getDefaultProfile(): boolean | undefined {
      // rsbuild v1
      const environmentProfile = (
        rspeedyConfig?.environments as
          | Record<string, { performance?: { profile?: boolean } }>
          | undefined
      )?.[environment.name]?.performance?.profile
      if (environmentProfile !== undefined) {
        return environmentProfile
      }

      const userProfile = lynxConfig?.performance.profile
      if (userProfile !== undefined) {
        return userProfile
      }

      if (isDebug()) {
        return true
      }

      return undefined
    }
  })
}

export const isDebug = (): boolean => {
  if (!process.env['DEBUG']) {
    return false
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',')
  return ['rspeedy', '*'].some((key) => values.includes(key))
}

// This is copied from https://github.com/web-infra-dev/rsbuild/blob/037da7b9d92e20c7136c8b2efa21eef539fa2f88/packages/core/src/plugins/html.ts#L168
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
      imports.push(...imports)
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
    // In standalone lazy bundle mode, due to an internal bug of `lynx.requireModule`,
    // it will cache module with same path (eg. `/.lynx/main/background.js`)
    // even they have different entryName (eg. `__Card__` and `http://[ip]:[port]/main/template.js`)
    // we need add hash (`/.lynx/main/background.[hash].js`) to avoid module conflict with the lazy bundle consumer.
    return DEFAULT_FILENAME_HASH
  } else {
    return EMPTY_HASH
  }
}
