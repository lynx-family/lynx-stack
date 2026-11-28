// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'
import path from 'node:path'

import type {
  ChainIdentifier,
  RsbuildPlugin,
  Rspack,
  RspackChain,
} from '@rsbuild/core'

import { parseLynxXML } from '@lynx-js/lynx-xml/parser'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { configureTemplate } from './template.plugin.js'
import { getLynxConfig } from '../config.js'
import type { LynxConfig } from '../config.js'
import { isLynx } from '../utils/is-lynx.js'

const PLUGIN_NAME = 'lynx:rsbuild:vanilla'
const ENTRY_WEBPACK_PLUGIN_NAME = 'LynxEntryWebpackPlugin'

const VANILLA_LAYERS = {
  BACKGROUND: 'vanilla:background',
  MAIN_THREAD: 'vanilla:main-thread',
} as const
Object.freeze(VANILLA_LAYERS)

interface LynxEntryContext {
  environmentName: string
  lynxConfig: LynxConfig
}

interface LynxEntryArtifacts {
  backgroundAsset: string
  mainThreadAsset: string
}

function getTemplateTarget(name: string): 'lynx' | 'web' | undefined {
  if (isLynx(name)) return 'lynx'
  return name === 'web' || name.startsWith('web-') ? 'web' : undefined
}

// Compile each unclaimed page entry for both threads, then delegate runtime
// wrapping and native/Web encoding to the shared template configuration.
export function pluginVanilla(): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    setup(api) {
      if (api.context.callerName === 'rslib') {
        // External bundles supply their own thread entries and template.
        api.modifyBundlerChain((chain, { CHAIN_ID }) => {
          const layers =
            api.useExposed<{ MAIN_THREAD: string, BACKGROUND: string }>(
              Symbol.for('LAYERS'),
            )
              ?? {
                MAIN_THREAD: 'lynx:main-thread',
                BACKGROUND: 'lynx:background',
              }
          const jsRule = chain.module.rule(CHAIN_ID.RULE.JS)
          const xml = /\.lynxml$/
          jsRule.test([jsRule.get('test')!, xml])
          const xmlRule = jsRule.oneOf(CHAIN_ID.ONE_OF.JS_MAIN).rule('lynxml')
            .test(xml)
          const require = createRequire(import.meta.url)
          const loader = path.join(
            path.dirname(require.resolve('@lynx-js/rsbuild-plugin')),
            'plugins/vanilla.plugin.js',
          )
          xmlRule.oneOf('main').issuerLayer(layers.MAIN_THREAD)
            .use('lynxml').loader(loader).options({ section: 'main' })
          // The logical background chunk owns the external bundle's <entry>:CSS section.
          xmlRule.oneOf('background').issuerLayer(layers.BACKGROUND)
            .use('lynxml').loader(loader).options({
              section: 'background',
              includeStyle: true,
            })
        })
        return
      }
      if (api.context.callerName === 'rstest') return

      // biome-ignore lint/correctness/useHookAtTopLevel: useExposed reads the Rsbuild plugin registry.
      const existingLayers: unknown = api.useExposed(Symbol.for('LAYERS'))
      // Expose layer names for consumers without replacing a DSL's exposure.
      // Entry ownership is determined from the environment's entries below.
      if (!existingLayers) api.expose(Symbol.for('LAYERS'), VANILLA_LAYERS)
      api.modifyBundlerChain({
        // ReactLynx assigns entry layers in a default-order async hook, which
        // Rsbuild awaits before post hooks. This also works when auto-registration
        // calls setup directly and bypasses the plugin's enforce ordering.
        order: 'post',
        handler(chain, { environment, CHAIN_ID }) {
          const target = getTemplateTarget(environment.name)
          if (target === undefined) return
          // Read the merged chain so preEntry, environment overrides, and
          // earlier plugins' entry changes are included.
          const entries = Object.entries(chain.entryPoints.entries() ?? {}).map(
            ([name, entry]) => [name, normalizeEntry(entry.values())] as const,
          )
          if (!checkVanillaEntries(entries, environment.name)) return

          // The fallback has no hot-update runtime. Remove Rsbuild's HMR
          // plugin only from this environment's compilation.
          chain.plugins.delete(CHAIN_ID.PLUGIN.HMR)
          // Analyze module side effects in development as well as production.
          // Page styles are collected from the main thread. A bare CSS import
          // should not keep an otherwise unused module in the background.
          chain.optimization.sideEffects(true)
          chain.module.rules.get(CHAIN_ID.RULE.CSS)
            ?.oneOfs.get(CHAIN_ID.ONE_OF.CSS_MAIN)
            ?.rule(VANILLA_LAYERS.BACKGROUND)
            .issuerLayer(VANILLA_LAYERS.BACKGROUND)
            .sideEffects(false)
          api.expose(Symbol.for('LAYERS'), VANILLA_LAYERS, {
            environment: environment.name,
          })
          configureThreadMacros(chain, CHAIN_ID)
          const context = {
            environmentName: environment.name,
            lynxConfig: getLynxConfig(api),
          }
          const artifacts = entries.map(([name, entry]) =>
            addLynxEntry(chain, name, entry, context)
          )
          chain.plugin(ENTRY_WEBPACK_PLUGIN_NAME).use(
            createLynxWebpackPlugin(
              artifacts.map(artifact => artifact.mainThreadAsset),
              Object.keys(chain.entryPoints.entries() ?? {}),
            ),
          )
          configureTemplate(chain, {
            target,
            backgroundAssets: artifacts.map(artifact =>
              artifact.backgroundAsset
            ),
          })
        },
      })
    },
  }
}

function checkVanillaEntries(
  entries: readonly (readonly [string, Rspack.EntryDescription])[],
  environmentName: string,
): boolean {
  // DSLs must assign their entry layers before the fallback hook. Return false
  // for an empty environment or one entirely owned by a DSL.
  const unlayered = entries.filter(([, entry]) => entry.layer === undefined)
  if (unlayered.length === 0) return false
  // Assembly and HMR configuration apply to the whole environment, so partially
  // claimed entries cannot safely share this fallback.
  if (unlayered.length !== entries.length) {
    throw new Error(
      `[pluginLynx] Vanilla and DSL entry layers cannot share environment \`${environmentName}\`. Configure them in separate environments.`,
    )
  }
  return true
}

function configureThreadMacros(
  chain: RspackChain,
  CHAIN_ID: ChainIdentifier,
): void {
  const rule = chain.module.rule(CHAIN_ID.RULE.JS)
    .oneOf(CHAIN_ID.ONE_OF.JS_MAIN)
  const uses = rule.uses.entries() ?? {}
  const swc = uses[CHAIN_ID.USE.SWC]
  if (!swc) {
    throw new Error(
      '[pluginLynx] Vanilla thread macros require the Rsbuild SWC loader.',
    )
  }
  const options = swc.get('options') as Rspack.SwcLoaderOptions
  const optimizer = options.jsc?.transform?.optimizer
  // Reuse the existing loader pipeline for each thread, changing only its SWC
  // macro definitions. Layer-specific compilation isolates the module graphs.
  rule.uses.clear()
  for (const layer of Object.values(VANILLA_LAYERS)) {
    const isMain = layer === VANILLA_LAYERS.MAIN_THREAD
    const threadRule = rule.oneOf(layer).issuerLayer(layer)
    for (const [name, use] of Object.entries(uses)) {
      threadRule.use(name).merge(
        use.entries() as Rspack.RuleSetLoaderWithOptions,
      )
    }
    threadRule.use(CHAIN_ID.USE.SWC).options(
      {
        ...options,
        jsc: {
          ...options.jsc,
          transform: {
            ...options.jsc?.transform,
            optimizer: {
              ...optimizer,
              globals: {
                ...optimizer?.globals,
                vars: {
                  ...optimizer?.globals?.vars,
                  __MAIN_THREAD__: String(isMain),
                  __BACKGROUND__: String(!isMain),
                },
              },
              // Prune inactive branches before Rspack resolves dependencies,
              // so imports belonging to the other thread are not bundled.
              simplify: true,
            },
          },
        },
      } satisfies Rspack.SwcLoaderOptions,
    )
  }
  // Modules outside the Vanilla layers retain the original loader behavior.
  rule.oneOf(`${PLUGIN_NAME}:default`).uses.merge(uses)
}

function addLynxEntry(
  chain: RspackChain,
  entryName: string,
  entry: Rspack.EntryDescription,
  context: LynxEntryContext,
): LynxEntryArtifacts {
  // The background name is internal; do not overwrite a page whose configured
  // name already ends in .background.
  let backgroundEntry = `${entryName}.background`
  while (chain.entryPoints.has(backgroundEntry)) {
    backgroundEntry += '.background'
  }
  const intermediateDir = context.lynxConfig.resolveIntermediateDir({
    entryName,
  })
  const backgroundAsset = path.posix.join(intermediateDir, 'background.js')
  const mainThreadAsset = path.posix.join(intermediateDir, 'main-thread.js')

  // Both threads start from the same imports. The layer-specific macros select
  // the active code; the original page name stays on the main-thread entry.
  chain.entry(backgroundEntry).add({
    ...entry,
    layer: VANILLA_LAYERS.BACKGROUND,
    filename: backgroundAsset,
  })

  chain.entry(entryName).clear().add({
    ...entry,
    layer: VANILLA_LAYERS.MAIN_THREAD,
    filename: mainThreadAsset,
  })

  chain.plugin(`${PLUGIN_NAME}:template:${entryName}`).use(
    LynxTemplatePlugin,
    [{
      ...LynxTemplatePlugin.defaultOptions,
      chunks: [backgroundEntry, entryName],
      // This is the engine's Element PAPI encoding mode, not a React runtime.
      dsl: 'react_nodiff',
      filename: context.lynxConfig.resolveBundleFilename({
        entryName,
        platform: context.environmentName,
      }),
      intermediate: intermediateDir,
    }],
  )

  return {
    backgroundAsset,
    mainThreadAsset,
  }
}

// Chain entries may mix strings, arrays, and descriptions (for example after
// preEntry injection). Preserve import order and let later descriptions win
// for other options, matching the chain's entry normalization semantics.
function normalizeEntry(values: unknown[]): Rspack.EntryDescription {
  const imports: string[] = []
  let options: Partial<Rspack.EntryDescription> = {}
  for (const value of values) {
    if (typeof value === 'string') {
      imports.push(value)
    } else if (Array.isArray(value)) {
      imports.push(...value as string[])
    } else {
      const entry = value as Rspack.EntryDescription
      options = { ...options, ...entry }
      imports.push(
        ...typeof entry.import === 'string'
          ? [entry.import]
          : entry.import ?? [],
      )
    }
  }
  return { ...options, import: imports }
}

function createLynxWebpackPlugin(
  mainThreadAssets: string[],
  entryNames: string[],
): Rspack.RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap(
        ENTRY_WEBPACK_PLUGIN_NAME,
        compilation => {
          compilation.hooks.processAssets.tap(
            {
              name: ENTRY_WEBPACK_PLUGIN_NAME,
              stage: compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            () => {
              // The template expects one self-contained script per thread.
              // Inspect emitted chunks because runtime/splitting options can
              // also be changed after our bundler-chain hook.
              for (const name of entryNames) {
                const entrypoint = compilation.entrypoints.get(name)
                const scripts = entrypoint?.getFiles().filter(file =>
                  /\.m?js(?:\?|$)/.test(file)
                ) ?? []
                const hasAsyncChunks = entrypoint?.chunks.some(chunk =>
                  chunk.getAllAsyncChunks().length > 0
                )
                // getFiles() does not necessarily include dependOn parents.
                const dependencies = compilation.entries.get(name)?.options
                  .dependOn
                if (
                  scripts.length !== 1 || hasAsyncChunks
                  || (dependencies?.length ?? 0) > 0
                ) {
                  throw new Error(
                    `[pluginLynx] Vanilla entry \`${name}\` must emit a single JavaScript asset. Independent runtimes, shared chunks, dependOn entries, and async chunks are not supported. Use performance.chunkSplit.strategy: 'all-in-one', keep the runtime in its entry, and avoid dependOn and split dynamic imports.`,
                  )
                }
              }
              // Mark before wrapping/encoding so the shared plugins classify
              // these JavaScript assets as main-thread code, not manifest code.
              for (const name of mainThreadAssets) {
                const asset = compilation.getAsset(name)
                if (!asset) {
                  throw new Error(
                    `[pluginLynx] Main-thread asset was not emitted: ${name}`,
                  )
                }
                compilation.updateAsset(asset.name, asset.source, {
                  ...asset.info,
                  'lynx:main-thread': true,
                })
              }
            },
          )
        },
      )
    },
  }
}

// Rspack loads the default export of the compiled vanilla.plugin module.
export default function lynxmlLoader(
  this: Rspack.LoaderContext<{
    section: 'main' | 'background' | 'style'
    includeStyle?: boolean
  }>,
  source: string,
): string {
  const parsed = parseLynxXML(source)
  if (!parsed.success) throw new Error(parsed.error.formattedMessage)

  const { section, includeStyle } = this.getOptions()
  if (section === 'style') return parsed.style ?? ''
  const script = section === 'main'
    ? parsed.mainThreadScript
    : parsed.backgroundThreadScript ?? ''
  if (!includeStyle || parsed.style === undefined) return script

  // Match the normal CSS pipeline while resolving URLs beside the original XML.
  const loader = this.loaders[this.loaderIndex]!.path
  const style =
    `${this.resourcePath}.css!=!${loader}?{"section":"style"}!${this.resource}`
  return `${script}\n;require(${JSON.stringify(style)});\n`
}
