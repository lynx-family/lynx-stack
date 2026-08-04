// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  NormalizedEnvironmentConfig,
  RsbuildPluginAPI,
  Rspack,
} from '@rsbuild/core'
import type { UndefinedOnPartialDeep } from 'type-fest'

import { LAYERS, ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
import type { ExposedAPI } from '@lynx-js/rspeedy'
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'

import { MTS_ENTRY_QUERY } from './loaders/mts-defines-entry-loader.js'
import {
  entriesDeclaringRootBoundary,
  resolveMTSRendering,
} from './mtsRendering.js'
import type { PluginReactLynxOptions } from './pluginReactLynx.js'
import { resolveLazyBundleFetcher } from './resolveLazyBundleFetcher.js'

const PLUGIN_NAME_REACT = 'lynx:react'
const PLUGIN_NAME_TEMPLATE = 'lynx:template'
const PLUGIN_NAME_RUNTIME_WRAPPER = 'lynx:runtime-wrapper'
const PLUGIN_NAME_WEB = 'lynx:web'
const RULE_MTS_DEFINES_ENTRY = 'react:mts-defines-entry'

const DEFAULT_DIST_PATH_INTERMEDIATE = '.rspeedy'
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
  } = options

  const lazyBundleFetcher = resolveLazyBundleFetcher(targetSdkVersion)

  api.modifyBundlerChain(async (chain, { environment, isDev, isProd }) => {
    const mainThreadChunks: string[] = []
    const mainThreadEntries: Record<string, string> = {}

    const { resolve, reactLynxDir } = api.useExposed<
      {
        resolve: (request: string) => Promise<string>
        reactLynxDir: string
      }
    >(Symbol.for('@lynx-js/react/internal:resolve'))!

    // A root-level `<Background>` — or its opt-in twin, a root-level
    // `<MainThread>` — in an entry is the declarative trigger for the
    // assembled main-thread bundle (`enableMTSRendering: false` is its
    // implementation). Resolve `'auto'` against the entry sources before the
    // entry points are rewritten below.
    const resolvedEnableMTSRendering = resolveMTSRendering(
      options,
      isProd,
      chain,
      api.context.rootPath,
      (message) => void (api.logger ?? console).warn(message),
    )

    const mtsDefinesEntry = path.join(
      reactLynxDir,
      'runtime/mts-rendering-disabled/index.js',
    )

    // Which entries declare a root first-screen boundary, and so have
    // something the main thread should compile and render. An entry without
    // one keeps the degenerate shape: the assembled definitions only, and an
    // empty first frame until the background hydrates.
    const entriesWithRootBoundary = resolvedEnableMTSRendering
      ? new Set<string>()
      : entriesDeclaringRootBoundary(chain, api.context.rootPath)

    /**
     * The main thread compiles the entry only to render what its root
     * boundary names: a `<Background>`'s fallback, which the transform folds
     * the boundary down to so the app's own module closure never reaches this
     * bundle — or a `<MainThread>`'s island, which is compiled for the main
     * thread precisely because the boundary keeps referencing it.
     *
     * The definitions runtime and the entry are pulled in through a single
     * generated root rather than as two entry imports — see
     * `loaders/mts-defines-entry-loader`, which is where the reason lives.
     */
    const mainThreadImportsFor = (
      entryName: string,
      imports: string[],
    ): string[] | undefined => {
      if (resolvedEnableMTSRendering) {
        return undefined
      }
      if (!entriesWithRootBoundary.has(entryName)) {
        return [mtsDefinesEntry]
      }
      return [
        `${mtsDefinesEntry}?${MTS_ENTRY_QUERY}=${
          encodeURIComponent(JSON.stringify(imports))
        }`,
      ]
    }

    if (!resolvedEnableMTSRendering) {
      chain
        .module
        .rule(RULE_MTS_DEFINES_ENTRY)
        .test(mtsDefinesEntry)
        .resourceQuery(new RegExp(`[?&]${MTS_ENTRY_QUERY}=`))
        .use(RULE_MTS_DEFINES_ENTRY)
        .loader(mtsDefinesEntryLoaderPath())
    }

    // The main thread only has something to render when at least one entry
    // brought a first frame with it; otherwise the render path is shaken out.
    const rendersOnMainThread = resolvedEnableMTSRendering
      || entriesWithRootBoundary.size > 0

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

    const isRspeedy = api.context.callerName === 'rspeedy'
    if (isRspeedy) {
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

        const bundleFilename =
          typeof rspeedyConfig?.output?.filename === 'object'
            ? rspeedyConfig.output.filename.bundle
              ?? rspeedyConfig.output.filename.template
            : rspeedyConfig?.output?.filename

        let templateFilename: string
        // `lazyBundleFilename` is only set when `bundle` is a function.
        // Otherwise `LynxTemplatePlugin` keeps its default
        // (`lazy-bundle/[name].[fullhash].bundle`).
        let lazyBundleFilename: string | undefined
        if (typeof bundleFilename === 'function') {
          // A single function controls both the main bundle and the lazy
          // bundles via the `lazyBundle` flag, without a dedicated
          // `lazyBundle` field.
          templateFilename = bundleFilename({
            lazyBundle: false,
            entryName,
            platform: environment.name,
          })
          lazyBundleFilename = bundleFilename({
            lazyBundle: true,
            // A lazy bundle name is resolved per async chunk, so there is no
            // single entry name for it.
            entryName: undefined,
            platform: environment.name,
          })
            // `[name]` is replaced per async chunk by `LynxTemplatePlugin`, so
            // we only resolve `[platform]` here.
            .replaceAll('[platform]', environment.name)
        } else {
          templateFilename = bundleFilename ?? '[name].[platform].bundle'
        }

        // We do not use `${entryName}__background` since the default CSS name is `[name]/[name].css`.
        // We would like to avoid adding `__background` to the output CSS filename.
        const mainThreadEntry = `${entryName}__main-thread`

        const mainThreadName = path.posix.join(
          isLynx
            // TODO: config intermediate
            ? DEFAULT_DIST_PATH_INTERMEDIATE
            // For non-Lynx environment, the entry is not deleted.
            // So we do not put it in the intermediate.
            : '',
          `${entryName}/main-thread.js`,
        )

        const backgroundName = path.posix.join(
          isLynx
            // TODO: config intermediate
            ? DEFAULT_DIST_PATH_INTERMEDIATE
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

        mainThreadEntries[mainThreadEntry] = backgroundEntry

        chain
          .entry(mainThreadEntry)
          .add({
            layer: LAYERS.MAIN_THREAD,
            import: mainThreadImportsFor(entryName, imports) ?? imports,
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
            filename: templateFilename.replaceAll('[name]', entryName)
              .replaceAll(
                '[platform]',
                environment.name,
              ),
            ...(lazyBundleFilename ? { lazyBundleFilename } : {}),
            intermediate: path.posix.join(
              DEFAULT_DIST_PATH_INTERMEDIATE,
              entryName,
            ),
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

    chain
      .plugin(PLUGIN_NAME_REACT)
      .after(PLUGIN_NAME_TEMPLATE)
      .use(ReactWebpackPlugin, [{
        disableCreateSelectorQueryIncompatibleWarning: compat
          ?.disableCreateSelectorQueryIncompatibleWarning ?? false,
        firstScreenSyncTiming,
        globalPropsMode,
        enableSSR,
        enableMTSRendering: resolvedEnableMTSRendering,
        rendersOnMainThread,
        mainThreadChunks,
        mainThreadEntries,
        extractStr,
        experimental_isLazyBundle,
        experimental_useElementTemplate:
          options.experimental_useElementTemplate,
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

      const userProfile = rspeedyConfig?.performance?.profile
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

/**
 * Carries this module's own extension, so the path resolves both from the
 * published `dist/index.js` and from `src/entry.ts` under the test runner —
 * rspack resolves loaders with the JS extension list, which would not find a
 * `.ts` sibling on its own.
 */
function mtsDefinesEntryLoaderPath(): string {
  const self = fileURLToPath(import.meta.url)
  return path.resolve(
    path.dirname(self),
    `loaders/mts-defines-entry-loader${path.extname(self)}`,
  )
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
    // it will cache module with same path (eg. `/.rspeedy/main/background.js`)
    // even they have different entryName (eg. `__Card__` and `http://[ip]:[port]/main/template.js`)
    // we need add hash (`/.rspeedy/main/background.[hash].js`) to avoid module conflict with the lazy bundle consumer.
    return DEFAULT_FILENAME_HASH
  } else {
    return EMPTY_HASH
  }
}
