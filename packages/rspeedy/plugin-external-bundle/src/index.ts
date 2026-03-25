// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A rsbuild plugin for loading external bundles using externals-loading-webpack-plugin.
 */

import { createReadStream, existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'

import type { RsbuildPlugin, RsbuildPluginAPI, Rspack } from '@rsbuild/core'

import type {
  ExternalValue,
  ExternalsLoadingPluginOptions,
} from '@lynx-js/externals-loading-webpack-plugin'
import { ExternalsLoadingPlugin } from '@lynx-js/externals-loading-webpack-plugin'

interface ExposedLayers {
  readonly BACKGROUND: string
  readonly MAIN_THREAD: string
}

const require = createRequire(import.meta.url)

const DEFAULT_REACT_UMD_PACKAGE_NAME = '@lynx-js/react-umd'
const REACT_LYNX_BUNDLE_FILE_NAME = 'react.lynx.bundle'

const reactLynxExternalTemplate = {
  '@lynx-js/react': {
    libraryName: ['ReactLynx', 'React'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/internal': {
    libraryName: ['ReactLynx', 'ReactInternal'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/jsx-dev-runtime': {
    libraryName: ['ReactLynx', 'ReactJSXDevRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/jsx-runtime': {
    libraryName: ['ReactLynx', 'ReactJSXRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/lepus/jsx-dev-runtime': {
    libraryName: ['ReactLynx', 'ReactJSXLepusDevRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/lepus/jsx-runtime': {
    libraryName: ['ReactLynx', 'ReactJSXLepusRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/experimental/lazy/import': {
    libraryName: ['ReactLynx', 'ReactLazyImport'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/legacy-react-runtime': {
    libraryName: ['ReactLynx', 'ReactLegacyRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/runtime-components': {
    libraryName: ['ReactLynx', 'ReactComponents'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/worklet-runtime/bindings': {
    libraryName: ['ReactLynx', 'ReactWorkletRuntime'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  '@lynx-js/react/debug': {
    libraryName: ['ReactLynx', 'ReactDebug'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
  preact: {
    libraryName: ['ReactLynx', 'Preact'],
    background: { sectionPath: 'ReactLynx' },
    mainThread: { sectionPath: 'ReactLynx__main-thread' },
    async: false,
  },
} satisfies Record<string, Omit<ExternalValue, 'url'>>

type ExternalsPresetValue = boolean | object

type ManagedBundleAssets = Map<string, string>

function toManagedBundleAssets(
  assets?: ManagedBundleAssets | Record<string, string>,
): ManagedBundleAssets {
  if (!assets) {
    return new Map()
  }
  if (assets instanceof Map) {
    return new Map(assets)
  }
  return new Map(Object.entries(assets))
}

/**
 * Options for the built-in `reactlynx` externals preset.
 *
 * @public
 */
export interface ReactLynxExternalsPresetOptions {
  /**
   * Emit the ReactLynx runtime bundle into the current build output and load it
   * through the generated runtime public path.
   *
   * Prefer this over `url` for normal Rspeedy projects. In addition to letting
   * the runtime resolve the final URL from `publicPath`, the plugin will also
   * copy the corresponding `@lynx-js/react-umd` bundle into the emitted assets,
   * so application bundles can reference it without requiring an extra manual
   * copy step when publishing.
   *
   * @defaultValue `'react.lynx.bundle'`
   */
  bundlePath?: string

  /**
   * Package name that provides the ReactLynx runtime bundle.
   *
   * Override this when wrapping the plugin for another distribution, such as
   * `@byted-lynx/react-umd`.
   *
   * @defaultValue `'@lynx-js/react-umd'`
   */
  reactUmdPackageName?: string

  /**
   * Override the runtime bundle URL directly.
   *
   * Use this only when the ReactLynx runtime is hosted outside the current
   * build output, for example on a CDN. Unlike `bundlePath`, this does not emit
   * any extra asset into the current compilation.
   *
   * @deprecated Prefer `bundlePath`, which resolves through the runtime public
   * path and enables automatic asset emission.
   */
  url?: string
}

/**
 * Presets for external bundle dependencies.
 *
 * @public
 */
export interface ExternalsPresets {
  /**
   * Load the ReactLynx runtime bundle and wire its standard module globals.
   */
  reactlynx?: boolean | ReactLynxExternalsPresetOptions

  /**
   * Additional custom preset flags.
   */
  [presetName: string]: boolean | object | undefined
}

/**
 * Context passed to externals preset resolvers.
 *
 * @public
 */
export interface ExternalsPresetContext {
  /**
   * The current Rsbuild project root path.
   */
  rootPath: string
}

/**
 * Definition for a named externals preset.
 *
 * @public
 */
export interface ExternalsPresetDefinition {
  /**
   * Other preset names to apply before the current preset.
   */
  extends?: string | string[]

  /**
   * Resolve external request mappings contributed by this preset.
   */
  resolveExternals?: (
    value: boolean | object,
    context: ExternalsPresetContext,
  ) => ExternalsLoadingPluginOptions['externals']

  /**
   * Resolve managed bundle assets contributed by this preset.
   */
  resolveManagedAssets?: (
    value: boolean | object,
    context: ExternalsPresetContext,
  ) => Map<string, string> | Record<string, string>
}

/**
 * Available externals preset definitions.
 *
 * @public
 */
export type ExternalsPresetDefinitions = Record<
  string,
  ExternalsPresetDefinition
>

/**
 * Built-in externals preset definitions.
 *
 * @public
 */
export const builtInExternalsPresetDefinitions: ExternalsPresetDefinitions =
  createBuiltInExternalsPresetDefinitions()

/**
 * Options for the external-bundle-rsbuild-plugin.
 *
 * @public
 */
export interface PluginExternalBundleOptions extends
  Pick<
    ExternalsLoadingPluginOptions,
    'globalObject'
  >
{
  /**
   * Root directory that stores project-owned external bundles referenced by
   * `bundlePath`.
   *
   * `pluginExternalBundle` uses this directory for both development serving
   * and build-time asset emission. Prefer setting this explicitly when
   * external bundles are built into a separate output folder, such as
   * `dist-external-bundle`.
   */
  externalBundleRoot?: string

  /**
   * Additional explicit externals to load.
   */
  externals?: Record<string, PluginExternalValue>

  /**
   * Built-in externals presets.
   */
  externalsPresets?: ExternalsPresets

  /**
   * Definitions for custom externals presets enabled by `externalsPresets`.
   *
   * Use this to add business-specific presets such as `tux`, or to extend a
   * built-in preset through `extends`.
   */
  externalsPresetDefinitions?: ExternalsPresetDefinitions
}

/**
 * External bundle reference accepted by `pluginExternalBundle`.
 *
 * @public
 */
export interface PluginExternalValue extends Omit<ExternalValue, 'url'> {
  /**
   * Bundle path resolved against the runtime public path.
   *
   * Prefer this over `url` when the external bundle should be emitted or served
   * as part of the current project. `pluginExternalBundle` can use this
   * information to manage local bundle files, while the runtime keeps the final
   * URL aligned with the active `publicPath`.
   */
  bundlePath?: string

  /**
   * Bundle URL.
   *
   * Use this only when the external bundle lives outside the current build
   * output and should not be emitted or served by `pluginExternalBundle`.
   *
   * @deprecated Prefer `bundlePath`, which resolves through the runtime public
   * path and lets higher-level tooling manage asset emission.
   */
  url?: string
}

function normalizeReactLynxPreset(
  preset: ExternalsPresets['reactlynx'],
): ReactLynxExternalsPresetOptions | undefined {
  if (!preset) {
    return undefined
  }
  return preset === true ? {} : preset
}

/**
 * Normalize a public bundle path by removing leading slashes.
 *
 * @public
 */
export function normalizeBundlePath(bundlePath: string): string {
  return bundlePath.replace(/^\/+/, '')
}

function createBuiltInExternalsPresetDefinitions(): ExternalsPresetDefinitions {
  return {
    reactlynx: {
      resolveExternals(value) {
        return createReactLynxExternals(
          normalizeReactLynxPreset(value as ExternalsPresets['reactlynx']),
        )
      },
      resolveManagedAssets(value, context) {
        const preset = normalizeReactLynxPreset(
          value as ExternalsPresets['reactlynx'],
        )
        if (!preset || preset.url) {
          return new Map()
        }
        return new Map([
          [
            getDefaultReactLynxBundlePath(preset),
            getReactLynxBundlePath(
              context.rootPath,
              preset.reactUmdPackageName ?? DEFAULT_REACT_UMD_PACKAGE_NAME,
            ),
          ],
        ])
      },
    },
  }
}

function getReactLynxBundlePath(
  rootPath: string,
  reactUmdPackageName: string,
): string {
  const reactUmdExport = process.env['NODE_ENV'] === 'production'
    ? `${reactUmdPackageName}/prod`
    : `${reactUmdPackageName}/dev`
  try {
    return require.resolve(reactUmdExport, { paths: [rootPath] })
  } catch {
    throw new Error(
      `external-bundle-rsbuild-plugin requires \`${reactUmdExport}\` when \`externalsPresets.reactlynx\` is enabled. Install a compatible \`${reactUmdPackageName}\` into your devDependencies.`,
    )
  }
}

function mergePresetDefinitions(
  baseDefinition: ExternalsPresetDefinition,
  extraDefinition: ExternalsPresetDefinition,
): ExternalsPresetDefinition {
  const baseExtends = baseDefinition.extends
    ? (Array.isArray(baseDefinition.extends)
      ? baseDefinition.extends
      : [baseDefinition.extends])
    : []
  const extraExtends = extraDefinition.extends
    ? (Array.isArray(extraDefinition.extends)
      ? extraDefinition.extends
      : [extraDefinition.extends])
    : []

  return {
    extends: [...baseExtends, ...extraExtends],
    resolveExternals(value, context) {
      return {
        ...(baseDefinition.resolveExternals?.(value, context) ?? {}),
        ...(extraDefinition.resolveExternals?.(value, context) ?? {}),
      }
    },
    resolveManagedAssets(value, context) {
      const assets = toManagedBundleAssets(
        baseDefinition.resolveManagedAssets?.(value, context),
      )
      for (
        const [bundlePath, sourcePath] of toManagedBundleAssets(
          extraDefinition.resolveManagedAssets?.(value, context),
        )
      ) {
        assets.set(bundlePath, sourcePath)
      }
      return assets
    },
  }
}

function resolvePresetDefinitions(
  presetDefinitions?: ExternalsPresetDefinitions,
): ExternalsPresetDefinitions {
  const resolvedDefinitions: ExternalsPresetDefinitions = {
    ...createBuiltInExternalsPresetDefinitions(),
  }

  for (
    const [presetName, presetDefinition] of Object.entries(
      presetDefinitions ?? {},
    )
  ) {
    const builtInDefinition = builtInExternalsPresetDefinitions[presetName]
    resolvedDefinitions[presetName] = builtInDefinition
      ? mergePresetDefinitions(builtInDefinition, presetDefinition)
      : presetDefinition
  }

  return resolvedDefinitions
}

function resolvePresetResult(
  presetName: string,
  presetValue: ExternalsPresetValue,
  presetDefinitions: ExternalsPresetDefinitions,
  resolving: string[],
  context: ExternalsPresetContext,
): {
  externals: ExternalsLoadingPluginOptions['externals']
  managedAssets: ManagedBundleAssets
} {
  const presetDefinition = presetDefinitions[presetName]
  if (!presetDefinition) {
    throw new Error(
      `Unknown externals preset "${presetName}". Define it in \`externalsPresetDefinitions\` before enabling it in \`externalsPresets\`.`,
    )
  }

  if (resolving.includes(presetName)) {
    throw new Error(
      `Circular externals preset dependency detected: ${
        [...resolving, presetName].join(' -> ')
      }`,
    )
  }

  const externals = {}
  const managedAssets = new Map<string, string>()
  const nextResolving = [...resolving, presetName]
  const inheritedPresetNames = presetDefinition.extends
    ? (Array.isArray(presetDefinition.extends)
      ? presetDefinition.extends
      : [presetDefinition.extends])
    : []

  for (const inheritedPresetName of inheritedPresetNames) {
    const inheritedResult = resolvePresetResult(
      inheritedPresetName,
      true,
      presetDefinitions,
      nextResolving,
      context,
    )
    Object.assign(externals, inheritedResult.externals)
    for (const [bundlePath, sourcePath] of inheritedResult.managedAssets) {
      managedAssets.set(bundlePath, sourcePath)
    }
  }

  Object.assign(
    externals,
    presetDefinition.resolveExternals?.(presetValue, context) ?? {},
  )
  for (
    const [bundlePath, sourcePath] of toManagedBundleAssets(
      presetDefinition.resolveManagedAssets?.(presetValue, context),
    )
  ) {
    managedAssets.set(bundlePath, sourcePath)
  }

  return { externals, managedAssets }
}

function resolvePresetExternals(
  externalsPresets: ExternalsPresets | undefined,
  presetDefinitions: ExternalsPresetDefinitions,
  context: ExternalsPresetContext,
): {
  externals: ExternalsLoadingPluginOptions['externals']
  managedAssets: ManagedBundleAssets
} {
  const externals = {}
  const managedAssets = new Map<string, string>()

  for (
    const [presetName, presetValue] of Object.entries(externalsPresets ?? {})
  ) {
    if (!presetValue) {
      continue
    }
    const resolvedPreset = resolvePresetResult(
      presetName,
      presetValue,
      presetDefinitions,
      [],
      context,
    )
    Object.assign(externals, resolvedPreset.externals)
    for (const [bundlePath, sourcePath] of resolvedPreset.managedAssets) {
      managedAssets.set(bundlePath, sourcePath)
    }
  }

  return { externals, managedAssets }
}

function createReactLynxExternals(
  preset: ReactLynxExternalsPresetOptions | undefined,
): ExternalsLoadingPluginOptions['externals'] {
  const bundleReference = preset?.url
    ? { url: preset.url }
    : { bundlePath: getDefaultReactLynxBundlePath(preset) }

  return Object.fromEntries(
    Object.entries(reactLynxExternalTemplate).map(([request, external]) => [
      request,
      {
        ...external,
        ...bundleReference,
      },
    ]),
  )
}

class EmitManagedBundleAssetsPlugin {
  constructor(
    private assets: ReadonlyMap<string, string>,
  ) {}

  apply(compiler: Rspack.Compiler): void {
    compiler.hooks.thisCompilation.tap(
      EmitManagedBundleAssetsPlugin.name,
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: EmitManagedBundleAssetsPlugin.name,
            // Emit managed bundle files after optimization so binary template
            // assets such as `*.template.js` are not treated as JS chunks by
            // later minification stages.
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
          },
          () => {
            const { RawSource } = compiler.webpack.sources
            for (const [bundlePath, sourcePath] of this.assets) {
              if (compilation.getAsset(bundlePath)) {
                continue
              }

              if (!existsSync(sourcePath)) {
                throw new Error(
                  `external-bundle-rsbuild-plugin could not find local bundle \`${sourcePath}\` for emitted asset \`${bundlePath}\`.`,
                )
              }

              compilation.emitAsset(
                bundlePath,
                new RawSource(readFileSync(sourcePath), false),
              )
            }
          },
        )
      },
    )
  }
}

function getDefaultReactLynxBundlePath(
  preset: ReactLynxExternalsPresetOptions | undefined,
) {
  return normalizeBundlePath(preset?.bundlePath ?? REACT_LYNX_BUNDLE_FILE_NAME)
}

function joinUrlPath(base: string | undefined, bundlePath: string) {
  const normalizedBase = base ?? '/'
  const normalizedBundlePath = normalizeBundlePath(bundlePath)
  if (normalizedBase === '/') {
    return `/${normalizedBundlePath}`
  }
  if (/^[a-z][a-z\d+\-.]*:/i.test(normalizedBase)) {
    try {
      return new URL(normalizedBundlePath, normalizedBase).toString()
    } catch {
      return `${normalizedBase.replace(/\/$/, '')}/${normalizedBundlePath}`
    }
  }
  return `${normalizedBase.replace(/\/$/, '')}/${normalizedBundlePath}`
}

function getExternalBundleRoot(
  options: PluginExternalBundleOptions,
  api: RsbuildPluginAPI,
): string {
  return path.resolve(
    api.context.rootPath,
    options.externalBundleRoot ?? 'dist-external-bundle',
  )
}

function getManagedBundleAssets(
  options: PluginExternalBundleOptions,
  presetManagedAssets: ManagedBundleAssets,
  api: RsbuildPluginAPI,
): Map<string, string> {
  const assets = new Map<string, string>(presetManagedAssets)

  const externalBundleRoot = getExternalBundleRoot(options, api)
  for (const external of Object.values(options.externals ?? {})) {
    if (external.url || !external.bundlePath) {
      continue
    }

    assets.set(
      normalizeBundlePath(external.bundlePath),
      path.resolve(
        externalBundleRoot,
        normalizeBundlePath(external.bundlePath),
      ),
    )
  }

  return assets
}

function getLocalBundleAssets(
  options: PluginExternalBundleOptions,
  presetManagedAssets: ManagedBundleAssets,
  api: RsbuildPluginAPI,
  serverBase: string | undefined,
): Map<string, string> {
  const assets = new Map<string, string>()
  for (
    const [bundlePath, sourcePath] of getManagedBundleAssets(
      options,
      presetManagedAssets,
      api,
    )
  ) {
    assets.set(
      joinUrlPath(serverBase, bundlePath),
      sourcePath,
    )
  }

  return assets
}

function resolvePluginExternals(
  externals: PluginExternalBundleOptions['externals'] | undefined,
): ExternalsLoadingPluginOptions['externals'] {
  if (!externals) {
    return {}
  }

  return externals
}

/**
 * Create a rsbuild plugin for loading external bundles.
 *
 * This plugin wraps the externals-loading-webpack-plugin and automatically
 * retrieves layer names from the react-rsbuild-plugin via api.useExposed.
 *
 * @example
 * ```ts
 * // lynx.config.ts
 * import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin'
 * import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
 *
 * export default {
 *   plugins: [
 *     pluginReactLynx(),
 *     pluginExternalBundle({
 *       externals: {
 *         lodash: {
 *           bundlePath: 'lodash.lynx.bundle',
 *           background: { sectionPath: 'background' },
 *           mainThread: { sectionPath: 'mainThread' },
 *         },
 *       },
 *     }),
 *   ],
 * }
 * ```
 *
 * @public
 */
export function pluginExternalBundle(
  options: PluginExternalBundleOptions,
): RsbuildPlugin {
  return {
    name: 'lynx:external-bundle',
    setup(api) {
      const presetDefinitions = resolvePresetDefinitions(
        options.externalsPresetDefinitions,
      )
      const presetResolution = resolvePresetExternals(
        options.externalsPresets,
        presetDefinitions,
        {
          rootPath: api.context.rootPath,
        },
      )

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const localBundleAssets = getLocalBundleAssets(
          options,
          presetResolution.managedAssets,
          api,
          config.server?.base,
        )

        if (localBundleAssets.size === 0) {
          return config
        }

        return mergeRsbuildConfig(config, {
          dev: {
            setupMiddlewares: [
              (middlewares) => {
                middlewares.unshift((
                  req: IncomingMessage,
                  res: ServerResponse,
                  next: () => void,
                ) => {
                  const bundlePath = req.url
                    ? localBundleAssets.get(req.url)
                    : undefined

                  if (bundlePath && existsSync(bundlePath)) {
                    res.setHeader(
                      'Content-Type',
                      'application/octet-stream',
                    )
                    res.setHeader('Access-Control-Allow-Origin', '*')
                    createReadStream(bundlePath).pipe(res)
                    return
                  }
                  next()
                })
                return middlewares
              },
            ],
          },
        })
      })

      api.modifyRspackConfig((config) => {
        const LAYERS = api.useExposed<ExposedLayers>(
          Symbol.for('LAYERS'),
        )

        if (!LAYERS) {
          throw new Error(
            'external-bundle-rsbuild-plugin requires exposed `LAYERS`.',
          )
        }

        const explicitExternals = resolvePluginExternals(
          options.externals,
        )
        const externals = {
          ...presetResolution.externals,
          ...explicitExternals,
        }
        const managedBundleAssets = getManagedBundleAssets(
          options,
          presetResolution.managedAssets,
          api,
        )

        config.plugins = config.plugins || []
        if (managedBundleAssets.size > 0) {
          config.plugins.push(
            new EmitManagedBundleAssetsPlugin(
              managedBundleAssets,
            ),
          )
        }
        config.plugins.push(
          new ExternalsLoadingPlugin({
            backgroundLayer: LAYERS.BACKGROUND,
            mainThreadLayer: LAYERS.MAIN_THREAD,
            externals,
            globalObject: options.globalObject,
          }),
        )
        return config
      })
    },
  }
}
