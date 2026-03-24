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
}

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

function normalizeBundlePath(bundlePath: string): string {
  return bundlePath.replace(/^\/+/, '')
}

function getReactLynxBundlePath(): string {
  const reactUmdExport = process.env['NODE_ENV'] === 'production'
    ? '@lynx-js/react-umd/prod'
    : '@lynx-js/react-umd/dev'
  try {
    return require.resolve(reactUmdExport)
  } catch {
    throw new Error(
      `external-bundle-rsbuild-plugin requires \`${reactUmdExport}\` when \`externalsPresets.reactlynx\` is enabled. Install a compatible \`@lynx-js/react-umd\` peer dependency.`,
    )
  }
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
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
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

function getDistPathRoot(
  distPath: string | { root?: string } | undefined,
): string | undefined {
  if (typeof distPath === 'string') {
    return distPath
  }
  return distPath?.root
}

function getConfigDistPathRoot(
  config: {
    output?: unknown
  },
): string | undefined {
  if (!config.output || typeof config.output !== 'object') {
    return undefined
  }

  const output = config.output as {
    distPath?: string | { root?: string }
  }
  return getDistPathRoot(output.distPath)
}

function getOutputDistRoot(
  api: RsbuildPluginAPI,
  config: {
    output?: unknown
  },
): string {
  const originalConfig = api.getRsbuildConfig('original')
  const distRoot = getConfigDistPathRoot(config)
    ?? getDistPathRoot(originalConfig.output?.distPath)
    ?? 'dist'

  return path.resolve(api.context.rootPath, distRoot)
}

function getExternalBundleRoot(
  options: PluginExternalBundleOptions,
  api: RsbuildPluginAPI,
  config: {
    output?: unknown
  },
): string {
  if (options.externalBundleRoot) {
    return path.resolve(api.context.rootPath, options.externalBundleRoot)
  }

  return getOutputDistRoot(api, config)
}

function getManagedBundleAssets(
  options: PluginExternalBundleOptions,
  reactLynxPreset: ReactLynxExternalsPresetOptions | undefined,
  api: RsbuildPluginAPI,
  config: {
    output?: unknown
  },
): Map<string, string> {
  const assets = new Map<string, string>()

  if (reactLynxPreset && !reactLynxPreset.url) {
    assets.set(
      getDefaultReactLynxBundlePath(reactLynxPreset),
      getReactLynxBundlePath(),
    )
  }

  const externalBundleRoot = getExternalBundleRoot(options, api, config)
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
  reactLynxPreset: ReactLynxExternalsPresetOptions | undefined,
  api: RsbuildPluginAPI,
  config: {
    output?: unknown
  },
  serverBase: string | undefined,
): Map<string, string> {
  const assets = new Map<string, string>()
  for (
    const [bundlePath, sourcePath] of getManagedBundleAssets(
      options,
      reactLynxPreset,
      api,
      config,
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
      const reactLynxPreset = normalizeReactLynxPreset(
        options.externalsPresets?.reactlynx,
      )

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const localBundleAssets = getLocalBundleAssets(
          options,
          reactLynxPreset,
          api,
          config,
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

        const reactLynxExternals = reactLynxPreset
          ? createReactLynxExternals(
            reactLynxPreset,
          )
          : {}
        const explicitExternals = resolvePluginExternals(
          options.externals,
        )
        const externals = {
          ...reactLynxExternals,
          ...explicitExternals,
        }
        const managedBundleAssets = getManagedBundleAssets(
          options,
          reactLynxPreset,
          api,
          config,
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
