// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { statSync } from 'node:fs'
import path from 'node:path'

import type {
  RsbuildPlugin,
  RsbuildPluginAPI,
  Rspack,
  RspackChain,
} from '@rsbuild/core'

import type { LynxConfig } from '@lynx-js/rsbuild-plugin'
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'

const S_LYNX_CONFIG = Symbol.for('@lynx-js/rsbuild-plugin:config')

const PLUGIN_NAME = 'lynx:vanilla'
const VANILLA_WEBPACK_PLUGIN_NAME = 'VanillaLynxWebpackPlugin'
const DEFAULT_ENGINE_VERSION = '3.5'

/**
 * Rspack layers used by Vanilla Lynx entries.
 *
 * @public
 */
export const LAYERS: Readonly<{
  BACKGROUND: 'vanilla:background'
  MAIN_THREAD: 'vanilla:main-thread'
}> = Object.freeze({
  BACKGROUND: 'vanilla:background',
  MAIN_THREAD: 'vanilla:main-thread',
})

/**
 * Context passed to a Vanilla Lynx bundle filename function.
 *
 * @public
 */
export interface VanillaBundleFilenameContext {
  /** The logical Rsbuild entry name. */
  entryName: string
  /** Vanilla Lynx currently emits only the main card bundle. */
  lazyBundle: false
  /** The Rsbuild environment name. */
  platform: string
}

/**
 * The final Vanilla Lynx bundle filename.
 *
 * @public
 */
export type VanillaBundleFilename =
  | string
  | ((
    context: VanillaBundleFilenameContext,
  ) => string)

/**
 * The two thread source files of a logical Vanilla Lynx entry.
 *
 * @public
 */
export interface VanillaLynxEntry {
  /**
   * Module request executed on the Lynx main thread with Element PAPI globals.
   *
   * @remarks
   * The request is resolved by Rspeedy or Rsbuild. When it names an existing
   * local file, optional sibling `background.ts` and `style.css` files are
   * discovered by convention.
   */
  mainThread: string

  /**
   * Source executed in the background JavaScript thread.
   *
   * @remarks
   * When omitted, a sibling `background.ts` is used when it exists. Set this
   * to `false` to explicitly create a main-thread-only bundle.
   */
  background?: string | false | undefined

  /**
   * CSS source encoded into the Lynx template.
   *
   * @remarks
   * When omitted, a sibling `style.css` is used when it exists. Set this to
   * `false` to disable the convention.
   */
  css?: string | false | undefined
}

/**
 * Options for {@link pluginVanillaLynx}.
 *
 * @public
 */
export interface PluginVanillaLynxOptions {
  /**
   * Explicit two-thread entries.
   *
   * @remarks
   * When omitted, every Rsbuild `source.entry` is treated as a main-thread
   * entry and optional sibling `background.ts` and `style.css` files are
   * discovered by convention.
   */
  entries?: Record<string, VanillaLynxEntry> | undefined

  /**
   * Override the final `.bundle` filename.
   *
   * @remarks
   * When omitted under Rspeedy, `output.filename.bundle` is used.
   * The default outside Rspeedy is `[name].[platform].bundle`.
   */
  bundleFilename?: VanillaBundleFilename | undefined

  /**
   * The minimum Lynx Engine version required by the emitted bundle.
   *
   * @defaultValue `'3.5'`
   */
  engineVersion?: string | undefined

  /**
   * Alias of {@link PluginVanillaLynxOptions.engineVersion}.
   *
   * @deprecated Use `engineVersion` instead.
   */
  targetSdkVersion?: string | undefined
}

interface LynxConfigExposure {
  config?: {
    targetSdkVersion?: string | undefined
  } | undefined
}

interface ResolvedVanillaEntry {
  backgroundSource?: string | undefined
  mainThreadImports: string[]
  styleSource?: string | undefined
}

interface ResolvedPluginVanillaLynxOptions {
  bundleFilename?: VanillaBundleFilename | undefined
  engineVersion: string
  entries?: Record<string, VanillaLynxEntry> | undefined
}

interface VanillaEntryContext {
  bundleFilename?: VanillaBundleFilename | undefined
  engineVersion: string
  platform: string
  lynxConfig: LynxConfig
}

interface VanillaEntryArtifacts {
  hasBackground: boolean
  mainThreadAsset: string
}

type VanillaPlatform = 'lynx' | 'web'

/**
 * Create the Vanilla Lynx DSL integration for Rsbuild or Rspeedy.
 *
 * A logical entry can explicitly declare its main-thread and background-thread
 * sources. As a shorthand, an Rsbuild entry is treated as the main-thread
 * source and optional sibling `background.ts` and `style.css` files are
 * discovered by convention.
 *
 * @public
 */
export function pluginVanillaLynx(
  options: PluginVanillaLynxOptions = {},
): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    pre: ['lynx:rsbuild:plugin-api', 'lynx:config'],
    setup(api) {
      const resolvedOptions = resolvePluginOptions(api, options)

      exposeVanillaCapabilities(api)
      disableVanillaHotUpdates(api)
      setupVanillaBundler(api, resolvedOptions)
    },
  }
}

function resolvePluginOptions(
  api: RsbuildPluginAPI,
  options: PluginVanillaLynxOptions,
): ResolvedPluginVanillaLynxOptions {
  const lynxConfig = api.useExposed<LynxConfigExposure>(
    Symbol.for('lynx.config'),
  )?.config

  return {
    bundleFilename: options.bundleFilename,
    engineVersion: options.engineVersion
      ?? options.targetSdkVersion
      ?? lynxConfig?.targetSdkVersion
      ?? DEFAULT_ENGINE_VERSION,
    entries: options.entries,
  }
}

function exposeVanillaCapabilities(api: RsbuildPluginAPI): void {
  api.expose(Symbol.for('LAYERS'), LAYERS)
}

function disableVanillaHotUpdates(api: RsbuildPluginAPI): void {
  // Vanilla Lynx does not yet install a compatible hot-update runtime.
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
    mergeRsbuildConfig(config, {
      dev: {
        hmr: false,
        liveReload: false,
      },
    })
  )
}

function setupVanillaBundler(
  api: RsbuildPluginAPI,
  options: ResolvedPluginVanillaLynxOptions,
): void {
  api.modifyBundlerChain((chain, { environment }) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: This is not a React hook.
    const lynxConfig = api.useExposed<LynxConfig>(S_LYNX_CONFIG)

    if (!lynxConfig) {
      throw new Error(
        'No Lynx config exposed. `pluginLynx` has to be applied for the Lynx build engine to be configured.',
      )
    }

    const platform = getVanillaPlatform(environment.name)

    if (!platform) {
      return
    }

    const entries = resolveVanillaEntries(
      api,
      chain.entryPoints.entries() ?? {},
      options.entries,
    )
    const entryContext: VanillaEntryContext = {
      bundleFilename: options.bundleFilename,
      engineVersion: options.engineVersion,
      platform: environment.name,
      lynxConfig,
    }

    chain.entryPoints.clear()

    const artifacts = entries.map(([entryName, entry]) =>
      addVanillaEntry(chain, entryName, entry, entryContext)
    )

    addVanillaBundlerPlugins(
      chain,
      artifacts,
      options.engineVersion,
      platform,
    )
  })
}

function addVanillaEntry(
  chain: RspackChain,
  entryName: string,
  entry: ResolvedVanillaEntry,
  context: VanillaEntryContext,
): VanillaEntryArtifacts {
  const { backgroundSource, styleSource } = entry
  const hasBackground = backgroundSource !== undefined

  const backgroundEntry = `${entryName}__background`
  const mainThreadEntry = `${entryName}__main-thread`
  const intermediateDir = context.lynxConfig.resolveIntermediateDir({
    entryName,
  })
  const backgroundAsset = path.posix.join(intermediateDir, 'background.js')
  const mainThreadAsset = path.posix.join(intermediateDir, 'main-thread.js')

  if (hasBackground) {
    chain.entry(backgroundEntry).add({
      layer: LAYERS.BACKGROUND,
      import: backgroundSource,
      filename: backgroundAsset,
    })
  }

  chain.entry(mainThreadEntry).add({
    layer: LAYERS.MAIN_THREAD,
    import: styleSource
      ? [...entry.mainThreadImports, styleSource]
      : entry.mainThreadImports,
    filename: mainThreadAsset,
  })

  chain.plugin(`${PLUGIN_NAME}:template:${entryName}`).use(
    LynxTemplatePlugin,
    [{
      ...LynxTemplatePlugin.defaultOptions,
      chunks: hasBackground
        ? [backgroundEntry, mainThreadEntry]
        : [mainThreadEntry],
      dsl: 'react_nodiff',
      filename: resolveVanillaBundleFilename(
        context.lynxConfig,
        context.bundleFilename,
        entryName,
        context.platform,
      ),
      intermediate: intermediateDir,
      targetSdkVersion: context.engineVersion,
    }],
  )

  return { hasBackground, mainThreadAsset }
}

function addVanillaBundlerPlugins(
  chain: RspackChain,
  artifacts: VanillaEntryArtifacts[],
  engineVersion: string,
  platform: VanillaPlatform,
): void {
  chain.plugin(VANILLA_WEBPACK_PLUGIN_NAME).use(
    createVanillaWebpackPlugin(
      artifacts.map(artifact => artifact.mainThreadAsset),
    ),
  )

  if (
    platform === 'lynx'
    && artifacts.some(artifact => artifact.hasBackground)
  ) {
    chain.plugin(`${PLUGIN_NAME}:runtime-wrapper`).use(
      RuntimeWrapperWebpackPlugin,
      [{
        targetSdkVersion: engineVersion,
        test: /^\.rspeedy\/.+\/background\.js$/,
      }],
    )
  }

  if (platform === 'lynx') {
    chain.plugin(LynxEncodePlugin.name).use(LynxEncodePlugin, [])
  } else {
    chain.plugin(WebEncodePlugin.name).use(WebEncodePlugin, [])
  }
}

function resolveVanillaEntries(
  api: RsbuildPluginAPI,
  rawEntries: Record<string, { values(): unknown[] }>,
  configuredEntries: Record<string, VanillaLynxEntry> | undefined,
): [string, ResolvedVanillaEntry][] {
  if (configuredEntries) {
    return Object.entries(configuredEntries).map(([entryName, entry]) => {
      const mainThreadSource = locateLocalSource(
        api.context.rootPath,
        entry.mainThread,
      )
      const entryDir = mainThreadSource
        ? path.dirname(mainThreadSource)
        : undefined

      return [entryName, {
        backgroundSource: resolveOptionalSource(
          entry.background,
          entryDir ? path.join(entryDir, 'background.ts') : undefined,
        ),
        mainThreadImports: [entry.mainThread],
        styleSource: resolveOptionalSource(
          entry.css,
          entryDir ? path.join(entryDir, 'style.css') : undefined,
        ),
      }]
    })
  }

  return Object.entries(rawEntries).map(([entryName, entryPoint]) => {
    const imports = getEntryImports(entryPoint.values())
    const mainThreadRequest = getMainThreadRequest(entryName, imports)
    const mainThreadSource = locateLocalSource(
      api.context.rootPath,
      mainThreadRequest,
    )
    const entryDir = mainThreadSource
      ? path.dirname(mainThreadSource)
      : undefined

    return [entryName, {
      backgroundSource: resolveOptionalSource(
        undefined,
        entryDir ? path.join(entryDir, 'background.ts') : undefined,
      ),
      mainThreadImports: imports,
      styleSource: resolveOptionalSource(
        undefined,
        entryDir ? path.join(entryDir, 'style.css') : undefined,
      ),
    }]
  })
}

function getVanillaPlatform(name: string): VanillaPlatform | undefined {
  if (name === 'lynx' || name.startsWith('lynx-')) {
    return 'lynx'
  }
  if (name === 'web' || name.startsWith('web-')) {
    return 'web'
  }
  return undefined
}

function getEntryImports(values: unknown[]): string[] {
  const imports: string[] = []

  for (const value of values) {
    if (typeof value === 'string') {
      imports.push(value)
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          imports.push(item)
        }
      }
      continue
    }

    if (typeof value !== 'object' || value === null || !('import' in value)) {
      continue
    }

    const entryImport = value.import
    if (typeof entryImport === 'string') {
      imports.push(entryImport)
    } else if (Array.isArray(entryImport)) {
      for (const item of entryImport) {
        if (typeof item === 'string') {
          imports.push(item)
        }
      }
    }
  }

  return imports
}

function getMainThreadRequest(
  entryName: string,
  imports: string[],
): string {
  const source =
    imports.find(value =>
      /(?:^|\/)main-thread\.[cm]?[jt]sx?(?:\?.*)?$/.test(
        value.replaceAll('\\', '/'),
      )
    ) ?? (imports.length === 1 ? imports[0] : undefined)

  if (!source) {
    throw new Error(
      `[pluginVanillaLynx] Entry \`${entryName}\` must contain exactly one `
        + '`main-thread.ts` source.',
    )
  }

  return source
}

function locateLocalSource(
  rootPath: string,
  request: string,
): string | undefined {
  const source = request.split(/[?#]/, 1)[0]
  if (!source) {
    return undefined
  }

  const candidate = path.isAbsolute(source)
    ? source
    : path.resolve(rootPath, source)

  return isFile(candidate) ? candidate : undefined
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function resolveOptionalSource(
  source: string | false | undefined,
  conventionSource: string | undefined,
): string | undefined {
  if (source === false) {
    return undefined
  }

  if (source) {
    return source
  }

  return conventionSource && isFile(conventionSource)
    ? conventionSource
    : undefined
}

function resolveVanillaBundleFilename(
  lynxConfig: LynxConfig,
  option: VanillaBundleFilename | undefined,
  entryName: string,
  platform: string,
): string {
  const context: VanillaBundleFilenameContext = {
    entryName,
    lazyBundle: false,
    platform,
  }

  if (option === undefined) {
    return lynxConfig.resolveBundleFilename({ entryName, platform })
  }

  const filename = typeof option === 'function' ? option(context) : option

  return filename
    .replaceAll('[name]', entryName)
    .replaceAll('[platform]', platform)
}

function createVanillaWebpackPlugin(
  mainThreadAssets: string[],
): Rspack.RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap(
        VANILLA_WEBPACK_PLUGIN_NAME,
        compilation => {
          compilation.hooks.processAssets.tap(
            {
              name: VANILLA_WEBPACK_PLUGIN_NAME,
              stage: compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              for (const name of mainThreadAssets) {
                const asset = compilation.getAsset(name)
                if (!asset) {
                  throw new Error(
                    `[pluginVanillaLynx] Main-thread asset was not emitted: ${name}`,
                  )
                }
                compilation.updateAsset(asset.name, asset.source, {
                  ...asset.info,
                  'lynx:main-thread': true,
                })
              }
            },
          )

          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          )
          hooks.beforeEncode.tap(VANILLA_WEBPACK_PLUGIN_NAME, args => {
            args.encodeData.sourceContent.config['enableEventHandleRefactor'] =
              true
            return args
          })
        },
      )
    },
  }
}
