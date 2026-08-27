// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { posix } from 'node:path'

import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'

/**
 * The context passed to the {@link LynxFilename.bundle} function.
 *
 * @public
 */
export interface BundleFilenameContext {
  /**
   * Whether the filename is being resolved for a lazy bundle (async chunk)
   * instead of the main bundle of an entry.
   */
  lazyBundle: boolean

  /**
   * The name of the entry.
   *
   * @remarks
   *
   * It is `undefined` for lazy bundles, since a lazy bundle name is resolved
   * per async chunk instead of per entry.
   */
  entryName?: string | undefined

  /**
   * The name of the Rsbuild environment.
   */
  platform: string
}

/**
 * The name of the bundle files.
 *
 * @public
 */
export type BundleFilename =
  | string
  | ((context: BundleFilenameContext) => string)

/**
 * The names of the files emitted by the Lynx build engine.
 *
 * @public
 */
export interface LynxFilename {
  /**
   * The name of the bundle files.
   *
   * @defaultValue `'[name].[platform].bundle'`
   *
   * @remarks
   *
   * The following placeholders are supported:
   *
   * - `[name]`: the name of the entry.
   * - `[platform]`: the name of the Rsbuild environment.
   */
  bundle?: BundleFilename | undefined
}

/**
 * The minifier options of the Lynx threads.
 *
 * @public
 *
 * @remarks
 *
 * Lynx emits one bundle per thread, and each thread may need different
 * minifier settings. These are merged on top of the Rsbuild
 * `output.minify.jsOptions` and applied to that thread only.
 */
export interface LynxMinify {
  /**
   * The minifier options of the main thread.
   */
  mainThreadOptions?: Rspack.SwcJsMinimizerRspackPluginOptions | undefined

  /**
   * The minifier options of the background thread.
   */
  backgroundOptions?: Rspack.SwcJsMinimizerRspackPluginOptions | undefined
}

/**
 * The output directories of the Lynx build engine.
 *
 * @public
 */
export interface LynxDistPath {
  /**
   * The directory of the intermediate files of a bundle.
   *
   * @defaultValue `'.rspeedy'`
   *
   * @remarks
   *
   * A Lynx bundle is encoded from per-thread JS, CSS and HMR outputs. They are
   * emitted into this directory, per entry, instead of next to the bundle.
   */
  intermediate?: string | undefined
}

/**
 * The build outputs of the Lynx build engine.
 *
 * @public
 */
export interface LynxOutput {
  /**
   * The output directories.
   */
  distPath?: LynxDistPath | undefined

  /**
   * The names of the emitted files.
   */
  filename?: LynxFilename | undefined

  /**
   * The per-thread minifier options.
   */
  minify?: LynxMinify | undefined
}

/**
 * The dev server client of the Lynx build engine.
 *
 * @public
 */
export interface LynxClient {
  /**
   * The module that provides the `WebSocket` used by HMR.
   *
   * @defaultValue `require.resolve('@lynx-js/websocket')`
   *
   * @remarks
   *
   * Lynx has no `WebSocket` global, so HMR resolves one from this module. The
   * module has to export it as `default`.
   */
  websocketTransport?: string | undefined
}

/**
 * The dev server options of the Lynx build engine.
 *
 * @public
 */
export interface LynxDev {
  /**
   * The dev server client.
   */
  client?: LynxClient | undefined
}

/**
 * The options of `pluginLynx`.
 *
 * @public
 */
export interface LynxPluginOptions {
  /**
   * The build outputs.
   */
  output?: LynxOutput | undefined

  /**
   * The dev server.
   */
  dev?: LynxDev | undefined
}

/**
 * The Lynx config that `pluginLynx` exposes to other plugins.
 *
 * @remarks
 *
 * The data mirrors {@link LynxPluginOptions}, so a plugin reads
 * `config.output.filename` the same way it reads `output.filename` from
 * `api.getRsbuildConfig()`. Values that depend on the entry being built are
 * derived by the methods, which travel with the data so that the plugin that
 * built the config is always the one that resolves it.
 *
 * @beta
 *
 * @example
 *
 * ```js
 * const lynx = getLynxConfig(api)
 * const filename = lynx.resolveBundleFilename({
 *   entryName: 'main',
 *   platform: environment.name,
 * })
 * ```
 */
export interface LynxConfig {
  /**
   * The build outputs.
   */
  readonly output: LynxOutput

  /**
   * Resolve the name of the bundle file of an entry.
   *
   * @param context - The entry to resolve the name for.
   */
  resolveBundleFilename(
    context: { entryName: string, platform: string },
  ): string

  /**
   * Resolve the directory of the intermediate files.
   *
   * @param context - The entry to resolve the directory for. Without an entry
   * name, the directory that holds every entry's is returned.
   */
  resolveIntermediateDir(
    context?: { entryName?: string | undefined },
  ): string

  /**
   * Resolve the name of the lazy bundle files.
   *
   * @param context - The environment to resolve the name for.
   *
   * @returns The resolved name, or `undefined` when {@link LynxFilename.bundle}
   * is not a function. A lazy bundle name can only be customized by a function,
   * since it is resolved per async chunk, so `undefined` means the caller
   * leaves the name to `LynxTemplatePlugin`.
   *
   * @remarks
   *
   * There is no entry name to resolve `[name]` with, so the placeholder is
   * kept for `LynxTemplatePlugin` to fill in per async chunk.
   */
  resolveLazyBundleFilename(
    context: { platform: string },
  ): string | undefined

  /**
   * The dev server.
   */
  readonly dev: LynxDev
}

// The key that `pluginLynx` exposes its `LynxConfig` with. It is not exported:
// a plugin reads the config through `api.useExposed` with this `Symbol.for`
// key, so it needs no runtime dependency on this package and always gets the
// resolvers of whichever copy built the config.
export const LYNX_CONFIG: symbol = Symbol.for(
  '@lynx-js/rsbuild-plugin:config',
)

const LYNX_CONFIG_MISSING =
  'No Lynx config exposed. `pluginLynx` has to be applied for the Lynx build engine to be configured.'

// Reads the config `pluginConfig` exposed. Every plugin `pluginLynx` returns
// sets up after it, so the config is always there for them.
export function getLynxConfig(api: RsbuildPluginAPI): LynxConfig {
  const config = api.useExposed<LynxConfig>(LYNX_CONFIG)

  if (!config) {
    throw new Error(LYNX_CONFIG_MISSING)
  }

  return config
}

const DEFAULT_BUNDLE_FILENAME = '[name].[platform].bundle'

const DEFAULT_DIST_PATH_INTERMEDIATE = '.rspeedy'

function resolve(
  bundle: BundleFilename | undefined,
  context: BundleFilenameContext,
): string {
  const filename = typeof bundle === 'function'
    ? bundle(context)
    : bundle ?? DEFAULT_BUNDLE_FILENAME

  const values: Record<string, string | undefined> = {
    '[name]': context.entryName,
    '[platform]': context.platform,
  }

  // Both placeholders are resolved in a single pass, so a value that
  // contains a placeholder is never resolved again. An unknown `[name]` is
  // kept as-is for `LynxTemplatePlugin` to fill in per async chunk.
  return filename.replaceAll(
    /\[name\]|\[platform\]/g,
    match => values[match] ?? match,
  )
}

/**
 * Create the {@link LynxConfig} described by `options`.
 *
 * @beta
 */
export function createLynxConfig(options: LynxPluginOptions): LynxConfig {
  const output = options.output ?? {}

  // The resolvers close over `output` instead of using `this`, so a caller can
  // destructure them off the config.
  return {
    output,

    dev: options.dev ?? {},

    resolveBundleFilename({ entryName, platform }) {
      return resolve(output.filename?.bundle, {
        lazyBundle: false,
        entryName,
        platform,
      })
    },

    resolveIntermediateDir(context) {
      const dir = output.distPath?.intermediate
        ?? DEFAULT_DIST_PATH_INTERMEDIATE

      return context?.entryName ? posix.join(dir, context.entryName) : dir
    },

    resolveLazyBundleFilename({ platform }) {
      const bundle = output.filename?.bundle

      return typeof bundle === 'function'
        ? resolve(bundle, { lazyBundle: true, entryName: undefined, platform })
        : undefined
    },
  }
}
