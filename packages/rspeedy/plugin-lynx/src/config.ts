// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

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
 * The build outputs of the Lynx build engine.
 *
 * @public
 */
export interface LynxOutput {
  /**
   * The names of the emitted files.
   */
  filename?: LynxFilename | undefined
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
}

/**
 * The Lynx config that `pluginLynx` exposes to other plugins.
 *
 * @remarks
 *
 * The data mirrors {@link LynxPluginOptions}, so a plugin reads
 * `config.output.filename` the same way it reads `output.filename` from
 * `api.getRsbuildConfig()`. Values that depend on the entry being built are
 * derived from it by {@link resolveBundleFilename} and
 * {@link resolveLazyBundleFilename}.
 *
 * @beta
 *
 * @example
 *
 * ```js
 * const lynx = getLynxConfig(api)
 * const filename = resolveBundleFilename(lynx, {
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
}

/**
 * The key that `pluginLynx` exposes its {@link LynxConfig} with. Read it with
 * {@link getLynxConfig} instead of `api.useExposed` unless you are providing
 * the config yourself.
 *
 * @beta
 */
export const LYNX_CONFIG: symbol = Symbol.for(
  '@lynx-js/rsbuild-plugin:config',
)

/**
 * Get the {@link LynxConfig} exposed by `pluginLynx`.
 *
 * @param api - The Rsbuild plugin API.
 *
 * @returns The {@link LynxConfig}. When `pluginLynx` is not applied, one using
 * the Lynx defaults is returned.
 *
 * @beta
 */
export function getLynxConfig(api: RsbuildPluginAPI): LynxConfig {
  return api.useExposed<LynxConfig>(LYNX_CONFIG) ?? DEFAULT_LYNX_CONFIG
}

const DEFAULT_BUNDLE_FILENAME = '[name].[platform].bundle'

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
 * Resolve the name of the bundle file of an entry.
 *
 * @param config - The {@link LynxConfig} to resolve the name from.
 * @param context - The entry to resolve the name for.
 *
 * @beta
 */
export function resolveBundleFilename(
  config: LynxConfig,
  context: { entryName: string, platform: string },
): string {
  return resolve(config.output.filename?.bundle, {
    lazyBundle: false,
    entryName: context.entryName,
    platform: context.platform,
  })
}

/**
 * Resolve the name of the lazy bundle files.
 *
 * @param config - The {@link LynxConfig} to resolve the name from.
 * @param context - The environment to resolve the name for.
 *
 * @returns The resolved name, or `undefined` when {@link LynxFilename.bundle}
 * is not a function. A lazy bundle name can only be customized by a function,
 * since it is resolved per async chunk, so `undefined` means the caller leaves
 * the name to `LynxTemplatePlugin`.
 *
 * @remarks
 *
 * There is no entry name to resolve `[name]` with, so the placeholder is kept
 * for `LynxTemplatePlugin` to fill in per async chunk.
 *
 * @beta
 */
export function resolveLazyBundleFilename(
  config: LynxConfig,
  context: { platform: string },
): string | undefined {
  const bundle = config.output.filename?.bundle

  return typeof bundle === 'function'
    ? resolve(bundle, {
      lazyBundle: true,
      entryName: undefined,
      platform: context.platform,
    })
    : undefined
}

/**
 * Create the {@link LynxConfig} described by `options`.
 *
 * @beta
 */
export function createLynxConfig(options: LynxPluginOptions): LynxConfig {
  return {
    output: options.output ?? {},
  }
}

export const DEFAULT_LYNX_CONFIG: LynxConfig = createLynxConfig({})
