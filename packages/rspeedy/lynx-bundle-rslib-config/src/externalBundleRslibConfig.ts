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
   * The engine version of the external bundle.
   *
   * @defaultValue '3.5'
   */
  engineVersion?: string

  /**
   * The output format of the encoded bundle.
   *
   * - `'tasm'`: the native TASM bundle via `@lynx-js/tasm`.
   * - `'web'`: a web binary bundle via `@lynx-js/web-core/encode`, decodable by
   *   the web platform. Sections are emitted as raw JS (the web runtime wraps
   *   them at `lynx.loadScript` time), and CSS is folded into the StyleInfo
   *   section.
   *
   * @defaultValue 'tasm'
   */
  target?: 'web' | 'tasm'

  /**
   * Whether to compile main thread chunks to JsBytecode in the emitted bundle.
   *
   * @remarks
   * When disabled, main thread chunks are encoded as plain JavaScript source,
   * which keeps them readable for debugging and speeds up encoding.
   *
   * Only takes effect for the `'tasm'` target. For the `'web'` target the
   * `JsBytecode` tag only routes main thread chunks to the correct bundle
   * slot (the chunk is never bytecode-compiled), so it is always kept.
   *
   * @defaultValue `false` when `NODE_ENV` is `'development'`, otherwise `true`
   */
  enableJsBytecode?: boolean
}

// When preact devtools is enabled (`REACT_DEVTOOL`), keep function and class
// names. Devtools relies on them to resolve component names (`type.name`) and
// to reconstruct the hook tree (it matches minified stack frames by function
// name). Minification would otherwise mangle/inline those names away. Only
// enabled with devtools since it slightly increases bundle size. Mirrors
// `pluginMinify` in @lynx-js/rspeedy (lynx-family/lynx-stack#2880).
const keepNames = Boolean(process.env['REACT_DEVTOOL'])

const DEFAULT_EXTERNAL_BUNDLE_MINIFY_CONFIG = {
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

        // `mangle.keep_*` below preserves most names, but the compressor can
        // still inline single-use functions (incl. one-shot components) into
        // anonymity; `compress.keep_*` stops that. Cheap, so we keep both.
        ...(keepNames ? { keep_fnames: true, keep_classnames: true } : {}),
      },
      ...(keepNames
        ? { mangle: { keep_fnames: true, keep_classnames: true } }
        : {}),
    },
  },
}

/**
 * The default lib config{@link LibConfig} for external bundle.
 *
 * @public
 */
export const DEFAULT_EXTERNAL_BUNDLE_LIB_CONFIG: LibConfig = {
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
    minify: process.env['NODE_ENV'] === 'development'
      ? false
      : DEFAULT_EXTERNAL_BUNDLE_MINIFY_CONFIG,
    target: 'web',
    dataUriLimit: Number.POSITIVE_INFINITY,
    distPath: {
      root: 'dist-external-bundle',
    },
  },
  source: {
    include: [/node_modules/],
  },
  tools: {
    rspack: {
      output: {
        library: {
          // `commonjs2` (not rslib's default `commonjs-static`): with an async
          // (`promise`) external the entry is an async module whose exports sit
          // behind a Promise; a static per-name copy reads `undefined`, whereas
          // `module.exports = ...` passes the Promise through for consumers to
          // await.
          type: 'commonjs2',
        },
      },
    },
  },
}

/**
 * Object form of an external mapping.
 *
 * Use this instead of the plain global-name form when the external library is
 * mounted asynchronously (as a Promise) by the consuming application, i.e. the
 * matching `pluginExternalBundle` external is configured with `async: true`.
 *
 * @public
 */
export interface ExternalObject {
  /**
   * The global name (with optional subpath) of the external library.
   */
  libraryName: string | string[]

  /**
   * Whether the library is mounted as a Promise resolving to the library
   * namespace. When enabled, the external is emitted as a `promise` external
   * so importing modules await the mounted value instead of reading it
   * synchronously.
   *
   * @defaultValue false
   */
  async?: boolean
}

/**
 * External module to global-name mappings used when building Lynx external
 * bundles.
 *
 * @public
 */
export type Externals = Record<string, string | string[] | ExternalObject>

/**
 * Standard ReactLynx external mappings used by the built-in `reactlynx`
 * preset.
 *
 * @public
 */
export const reactLynxExternalsPreset: Externals = {
  'react': ['ReactLynx', 'React'],
  '@lynx-js/react': ['ReactLynx', 'React'],
  '@lynx-js/react/internal': ['ReactLynx', 'ReactInternal'],
  '@lynx-js/react/jsx-dev-runtime': ['ReactLynx', 'ReactJSXDevRuntime'],
  '@lynx-js/react/jsx-runtime': ['ReactLynx', 'ReactJSXRuntime'],
  '@lynx-js/react/lepus/jsx-dev-runtime': [
    'ReactLynx',
    'ReactJSXLepusDevRuntime',
  ],
  '@lynx-js/react/lepus/jsx-runtime': ['ReactLynx', 'ReactJSXLepusRuntime'],
  '@lynx-js/react/experimental/lazy/import': [
    'ReactLynx',
    'ReactLazyImport',
  ],
  '@lynx-js/react/legacy-react-runtime': [
    'ReactLynx',
    'ReactLegacyRuntime',
  ],
  '@lynx-js/react/runtime-components': ['ReactLynx', 'ReactComponents'],
  '@lynx-js/react/worklet-runtime/bindings': [
    'ReactLynx',
    'ReactWorkletRuntime',
  ],
  '@lynx-js/react/debug': ['ReactLynx', 'ReactDebug'],
  preact: ['ReactLynx', 'Preact'],
}

/**
 * How an externals preset is enabled.
 *
 * `true` mounts the preset's libraries synchronously. The `{ async: true }`
 * object form mounts them asynchronously (as Promises), for the web target
 * where external bundles are loaded via `fetchBundle().then` — see
 * {@link ExternalObject.async}.
 *
 * @public
 */
export type ExternalsPresetValue = boolean | { async?: boolean }

/**
 * Enabled externals presets.
 *
 * Preset names are resolved from the built-in preset definitions plus any
 * custom definitions passed to {@link defineExternalBundleRslibConfig}.
 *
 * @public
 */
export type ExternalsPresets = {
  reactlynx?: ExternalsPresetValue
} & Record<string, ExternalsPresetValue>

/**
 * Definition for a named externals preset.
 *
 * @public
 */
export interface ExternalsPresetDefinition {
  /**
   * Other preset names to include before applying the current preset.
   */
  extends?: string | string[]

  /**
   * Externals contributed by this preset.
   */
  externals?: Externals
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
export const builtInExternalsPresetDefinitions: ExternalsPresetDefinitions = {
  reactlynx: {
    externals: reactLynxExternalsPreset,
  },
}

/**
 * Output config accepted by Lynx external bundle builds.
 *
 * @public
 */
export type OutputConfig = Required<LibConfig>['output'] & {
  /**
   * Presets for external libraries.
   *
   * Same as https://rspack.rs/config/externals#externalspresets but for Lynx.
   */
  externalsPresets?: ExternalsPresets
  /**
   * Definitions for custom externals presets enabled by `externalsPresets`.
   *
   * Use this to add business-specific presets such as `@lynx-js/lynx-ui`, or to extend a
   * built-in preset through `extends`.
   */
  externalsPresetDefinitions?: ExternalsPresetDefinitions
  externals?: Externals
  /**
   * This option indicates what global object will be used to mount the library.
   *
   * In Lynx, the library will be mounted to `lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]` by default.
   *
   * If you have enabled share js context and want to reuse the library by mounting to the global object, you can set this option to `'globalThis'`.
   *
   * @defaultValue `'lynx'`
   */
  globalObject?: 'lynx' | 'globalThis'
}

/**
 * Rslib config shape accepted by `defineExternalBundleRslibConfig`.
 *
 * @public
 */
export interface ExternalBundleLibConfig extends LibConfig {
  output?: OutputConfig
}

/**
 * Resolve a single preset into the final external map that Rslib should use.
 *
 * This walks `extends` recursively so a business preset can layer on top of a
 * built-in preset such as `reactlynx`, while still detecting unknown preset
 * names and circular references early.
 */
function resolvePresetExternals(
  presetName: string,
  presetDefinitions: ExternalsPresetDefinitions,
  resolving: string[],
): Externals {
  const presetDefinition = presetDefinitions[presetName]
  if (!presetDefinition) {
    throw new Error(
      `Unknown externals preset "${presetName}". Define it in \`output.externalsPresetDefinitions\` before enabling it in \`output.externalsPresets\`.`,
    )
  }

  if (resolving.includes(presetName)) {
    throw new Error(
      `Circular externals preset dependency detected: ${
        [...resolving, presetName].join(' -> ')
      }`,
    )
  }

  const mergedExternals: Externals = {}
  const nextResolving = [...resolving, presetName]
  const inheritedPresetNames = presetDefinition.extends
    ? (Array.isArray(presetDefinition.extends)
      ? presetDefinition.extends
      : [presetDefinition.extends])
    : []
  // recursively resolve extended presets
  for (const inheritedPresetName of inheritedPresetNames) {
    Object.assign(
      mergedExternals,
      resolvePresetExternals(
        inheritedPresetName,
        presetDefinitions,
        nextResolving,
      ),
    )
  }

  Object.assign(mergedExternals, presetDefinition.externals)

  return mergedExternals
}

/**
 * Merge user-provided preset definitions with the built-in preset table.
 *
 * A custom definition with the same name as a built-in preset is treated as an
 * extension of that preset instead of a full replacement, so callers can
 * augment `reactlynx` without re-declaring all of its default externals.
 */
function resolvePresetDefinitions(
  presetDefinitions?: ExternalsPresetDefinitions,
): ExternalsPresetDefinitions {
  const resolvedDefinitions = {
    ...builtInExternalsPresetDefinitions,
  }

  for (
    const [presetName, presetDefinition] of Object.entries(
      presetDefinitions ?? {},
    )
  ) {
    const builtInPresetDefinition =
      builtInExternalsPresetDefinitions[presetName]
    if (!builtInPresetDefinition) {
      resolvedDefinitions[presetName] = presetDefinition
      continue
    }

    const builtInExtends = builtInPresetDefinition.extends
      ? (Array.isArray(builtInPresetDefinition.extends)
        ? builtInPresetDefinition.extends
        : [builtInPresetDefinition.extends])
      : []
    const customExtends = presetDefinition.extends
      ? (Array.isArray(presetDefinition.extends)
        ? presetDefinition.extends
        : [presetDefinition.extends])
      : []

    resolvedDefinitions[presetName] = {
      extends: [...builtInExtends, ...customExtends],
      externals: {
        ...builtInPresetDefinition.externals,
        ...presetDefinition.externals,
      },
    }
  }

  return resolvedDefinitions
}

/**
 * Convert Lynx-friendly preset/object config into the low-level Rslib
 * `output.externals` callback.
 *
 * This is the bridge between:
 * - preset-based config exposed by `defineExternalBundleRslibConfig`, and
 * - the final `var` externals shape consumed by Rspack/Rslib.
 */
/**
 * Convert a preset's externals to the async ({@link ExternalObject} `async`)
 * form so the produced bundle awaits each library before reading its subpaths.
 */
function toAsyncExternals(externals: Externals): Externals {
  return Object.fromEntries(
    Object.entries(externals).map(([request, value]) => [
      request,
      typeof value === 'object' && !Array.isArray(value)
        ? { ...value, async: true }
        : { libraryName: value, async: true },
    ]),
  )
}

function transformExternals(
  externalsPresets?: ExternalsPresets,
  externals?: Externals,
  globalObject?: string,
  presetDefinitions?: ExternalsPresetDefinitions,
): Required<Required<LibConfig>['output']>['externals'] {
  const resolvedPresetDefinitions = resolvePresetDefinitions(presetDefinitions)

  if (externalsPresets) {
    const presetExternals: Externals = {}
    for (const [presetName, presetValue] of Object.entries(externalsPresets)) {
      if (!presetValue) {
        continue
      }
      const resolved = resolvePresetExternals(
        presetName,
        resolvedPresetDefinitions,
        [],
      )
      const isAsync = typeof presetValue === 'object'
        && presetValue.async === true
      Object.assign(
        presetExternals,
        isAsync ? toAsyncExternals(resolved) : resolved,
      )
    }
    externals = {
      ...presetExternals,
      ...externals,
    }
  }

  if (!externals) return {}

  return function({ request }, callback) {
    if (!request) return callback()
    const external = externals[request]
    if (!external) return callback()

    const isObjectForm = typeof external === 'object'
      && !Array.isArray(external)
    const libraryName = isObjectForm ? external.libraryName : external
    const names = Array.isArray(libraryName) ? libraryName : [libraryName]
    const lynxExternalGlobal = `${
      globalObject ?? 'lynx'
    }[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]`

    if (isObjectForm && external.async) {
      // One promise per library, mounted at `names[0]` and resolving to the
      // whole namespace; pick subpaths inside `.then` after it resolves. An
      // array request would read them off the pending promise and yield
      // undefined.
      const mount = `${lynxExternalGlobal}[${JSON.stringify(names[0])}]`
      const accessor = names.slice(1).map((name) => `[${JSON.stringify(name)}]`)
        .join('')
      return callback(
        undefined,
        accessor
          ? `Promise.resolve(${mount}).then(function (m) { return m${accessor}; })`
          : mount,
        'promise',
      )
    }

    callback(undefined, [lynxExternalGlobal, ...names], 'var')
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
 * import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'utils-lib',
 *   source: {
 *     entry: {
 *       utils: {
 *         import: './src/utils.ts',
 *         layer: 'background',
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
 * import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config'
 *
 * export default defineExternalBundleRslibConfig({
 *   id: 'utils-lib',
 *   source: {
 *     entry: {
 *       utils: {
 *         import: './src/utils.ts',
 *         layer: 'main-thread',
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
  const normalizedOutputMinify = userLibConfig.output?.minify === true
    ? DEFAULT_EXTERNAL_BUNDLE_MINIFY_CONFIG
    : userLibConfig.output?.minify

  return {
    lib: [
      rsbuild.mergeRsbuildConfig<LibConfig>(
        DEFAULT_EXTERNAL_BUNDLE_LIB_CONFIG,
        {
          ...userLibConfig,
          output: {
            ...userLibConfig.output,
            minify: normalizedOutputMinify,
            externals: transformExternals(
              userLibConfig.output?.externalsPresets,
              userLibConfig.output?.externals,
              userLibConfig.output?.globalObject,
              userLibConfig.output?.externalsPresetDefinitions,
            ),
          },
        },
      ),
    ],
    plugins: [
      externalBundleRsbuildPlugin({
        engineVersion: encodeOptions.engineVersion,
        target: encodeOptions.target,
        enableJsBytecode: encodeOptions.enableJsBytecode,
      }),
    ],
  }
}

interface ExposedLayers {
  readonly BACKGROUND: string
  readonly MAIN_THREAD: string
}

/**
 * Rewrite user entries into explicit background/main-thread entries.
 *
 * External bundles are emitted per thread, so a single logical entry without
 * an explicit layer is expanded into two concrete entries:
 * - `<name>` for background
 * - `<name>__main-thread` for main thread
 */
const externalBundleRsbuildPlugin = ({
  engineVersion,
  target,
  enableJsBytecode,
}: {
  engineVersion: string | undefined
  target: 'web' | 'tasm' | undefined
  enableJsBytecode: boolean | undefined
}): rsbuild.RsbuildPlugin => ({
  name: 'lynx:external-bundle',
  // ensure dsl plugin has exposed LAYERS
  enforce: 'post',
  setup(api) {
    // Get layer names from react-rsbuild-plugin
    const LAYERS = api.useExposed<ExposedLayers>(
      Symbol.for('LAYERS'),
    )

    if (!LAYERS) {
      throw new Error(
        'lynx-bundle-rslib-config requires exposed `LAYERS`. Please install a DSL plugin, for example `pluginReactLynx` for ReactLynx.',
      )
    }

    api.modifyBundlerChain(
      async (chain, { CHAIN_ID, environment: { name: libName } }) => {
        // Mark the react loaders as building an external bundle.
        const jsMainRule = chain.module
          .rule(CHAIN_ID.RULE.JS)
          .oneOf(CHAIN_ID.ONE_OF.JS_MAIN)
        for (const layer of [LAYERS.BACKGROUND, LAYERS.MAIN_THREAD]) {
          // Only tap when the DSL plugin has registered a loader for this
          // layer. Creating the use entry here would produce a loader-less
          // `{ options }` record that Rspack >= 2.0.8 rejects.
          const layerUse = jsMainRule.oneOfs.get(layer)?.uses.get(layer)
          if (!layerUse) {
            continue
          }
          layerUse.tap((loaderOptions) => ({
            ...(loaderOptions as Record<string, unknown>),
            isExternalBundle: true,
          }))
        }

        // copy entries
        const entries = chain.entryPoints.entries() ?? {}

        chain.entryPoints.clear()

        const backgroundEntryName: string[] = []
        const mainThreadEntryName: string[] = []
        const mainThreadChunks: string[] = []

        const addLayeredEntry = (
          entryName: string,
          entryValue: Rspack.EntryDescription,
        ) => {
          const isMainThread = entryValue.layer === LAYERS.MAIN_THREAD
          if (isMainThread) {
            mainThreadChunks.push(entryName + '.js')
          }

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
                addLayeredEntry(entryName, {
                  ...value,
                  layer: LAYERS.BACKGROUND,
                })
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
        const isWeb = target === 'web'

        // The native lynx_core module wrapper is added at build time only for
        // the `tasm` target. For web, the runtime (createChunkLoading) wraps
        // each section when `lynx.loadScript` evaluates it, so sections are
        // emitted raw.
        if (!isWeb) {
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
        }

        let encode: (opts: unknown) => Promise<{ buffer: Buffer }>
        if (isWeb) {
          const { getWebEncodeMode } = await import('./webpack/webEncode.js')
          encode = getWebEncodeMode()
        } else {
          const { getEncodeMode } = await import('@lynx-js/tasm')
          encode = getEncodeMode()
        }

        // dprint-ignore
        chain
        .plugin(ExternalBundleWebpackPlugin.name)
        .use(
          ExternalBundleWebpackPlugin,
          [
            {
              bundleFileName: `${libName}.${isWeb ? 'web' : 'lynx'}.bundle`,
              encode,
              engineVersion,
              mainThreadChunks,
              // For web the `JsBytecode` tag is routing-only (sections stay
              // raw JS), so it must survive regardless of the user option.
              enableJsBytecode: isWeb ? true : enableJsBytecode,
            },
          ],
        )
        .end()
      },
    )
  },
})

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
