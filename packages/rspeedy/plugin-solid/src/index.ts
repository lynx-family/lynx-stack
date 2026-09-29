// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * Rsbuild integration for compiling one SolidJS source tree into Lynx main
 * and background thread bundles.
 */

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { modifyBabelLoaders, pluginBabel } from '@rsbuild/plugin-babel'
import { pluginSolid } from '@rsbuild/plugin-solid'
import type { PluginSolidOptions } from '@rsbuild/plugin-solid'

import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
} from '@lynx-js/element-template-runtime'
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
import { LAYERS, pluginVanillaLynx } from '@lynx-js/vanilla-rsbuild-plugin'
import type { PluginVanillaLynxOptions } from '@lynx-js/vanilla-rsbuild-plugin'

import { SOLID_ELEMENT_TEMPLATE_BUILD_INFO } from './transform.js'

const SOLID_ELEMENT_TEMPLATE_PLUGIN = 'SolidLynxElementTemplatePlugin'
const SOLID_ELEMENT_TEMPLATE_LOADER = 'solid:element-template-loader'

type SolidCompilerOptions = NonNullable<PluginSolidOptions['solid']>

interface ElementTemplateBuildInfo {
  compiledTemplate: Record<string, unknown>
  templateId: string
}

interface ModuleWithElementTemplateBuildInfo {
  buildInfo?: Record<string, unknown>
  modules?: Iterable<ModuleWithElementTemplateBuildInfo>
}

/**
 * Options for {@link pluginSolidLynx}.
 *
 * @public
 */
export interface PluginSolidLynxOptions
  extends Omit<PluginVanillaLynxOptions, 'singleSource'>
{
  /**
   * Lynx element names that may be created dynamically outside compiled JSX.
   */
  elements?: readonly string[] | undefined

  /**
   * Additional options passed to the Solid JSX compiler.
   *
   * `generate`, `moduleName`, and `delegateEvents` are owned by SolidLynx.
   */
  solid?:
    | Omit<
      SolidCompilerOptions,
      'delegateEvents' | 'generate' | 'moduleName'
    >
    | undefined
}

function collectElementTemplates(
  module: ModuleWithElementTemplateBuildInfo,
): ElementTemplateBuildInfo[] {
  const result: ElementTemplateBuildInfo[] = []
  const templates = module.buildInfo?.[SOLID_ELEMENT_TEMPLATE_BUILD_INFO]
  if (Array.isArray(templates)) {
    result.push(...templates as ElementTemplateBuildInfo[])
  }
  for (const nestedModule of module.modules ?? []) {
    result.push(...collectElementTemplates(nestedModule))
  }
  return result
}

function mergeElementTemplate(
  target: Record<string, unknown>,
  asset: ElementTemplateBuildInfo,
): void {
  const existing = target[asset.templateId]
  if (
    existing !== undefined
    && JSON.stringify(existing) !== JSON.stringify(asset.compiledTemplate)
  ) {
    throw new Error(
      `SolidLynx Element Template id collision: ${asset.templateId}.`,
    )
  }
  target[asset.templateId] = asset.compiledTemplate
}

function resolveElementTemplateLoader(): string {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
  const adjacent = path.join(currentDirectory, 'loader.js')
  return existsSync(adjacent)
    ? adjacent
    : path.join(currentDirectory, '../dist/loader.js')
}

function pluginSolidElementTemplateTransform(): RsbuildPlugin {
  return {
    name: 'lynx:solid:element-template-transform',
    setup(api) {
      api.modifyBundlerChain((chain, { CHAIN_ID }) => {
        modifyBabelLoaders({
          chain,
          CHAIN_ID,
          modifyRule(rule, { babelUseId }) {
            rule
              .use(SOLID_ELEMENT_TEMPLATE_LOADER)
              .before(babelUseId)
              .loader(resolveElementTemplateLoader())
          },
        })
      })
    },
  }
}

function createElementTemplatePlugin(
  fallbackElements: readonly string[],
): Rspack.RspackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap(
        SOLID_ELEMENT_TEMPLATE_PLUGIN,
        compilation => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          )
          hooks.beforeEncode.tap(SOLID_ELEMENT_TEMPLATE_PLUGIN, args => {
            args.encodeData.compilerOptions['enableElementTemplate'] = true
            args.encodeData.sourceContent.config['enableElementTemplate'] = true
            args.encodeData.sourceContent.config['enableUnifyFixedBehavior'] =
              true
            const elementTemplate = args.encodeData.elementTemplate ?? {}
            const visited = new Set<ModuleWithElementTemplateBuildInfo>()
            for (const chunkGroup of args.chunkGroups) {
              for (const chunk of chunkGroup.chunks) {
                for (
                  const module of compilation.chunkGraph.getChunkModules(chunk)
                ) {
                  if (visited.has(module)) {
                    continue
                  }
                  visited.add(module)
                  for (const asset of collectElementTemplates(module)) {
                    mergeElementTemplate(elementTemplate, asset)
                  }
                }
              }
            }
            for (const type of fallbackElements) {
              elementTemplate[type] ??= {
                kind: 'element',
                type,
                attributesArray: [
                  {
                    kind: 'spread',
                    attrSlotIndex: ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
                  },
                ],
                children: [{
                  kind: 'childSlot',
                  type: 'slot',
                  elementSlotIndex: 0,
                }],
              }
            }
            elementTemplate[BUILTIN_RAW_TEXT_TEMPLATE_KEY] ??= {
              kind: 'element',
              type: 'raw-text',
              attributesArray: [
                {
                  kind: 'slot',
                  key: 'text',
                  attrSlotIndex: 0,
                },
              ],
              children: [],
            }
            args.encodeData.elementTemplate = elementTemplate
            return args
          })
        },
      )
    },
  }
}

function pluginSolidElementTemplateMetadata(
  elements: readonly string[],
): RsbuildPlugin {
  return {
    name: 'lynx:solid:element-template',
    setup(api) {
      api.modifyBundlerChain(chain => {
        chain.plugin(SOLID_ELEMENT_TEMPLATE_PLUGIN).use(
          createElementTemplatePlugin(elements),
        )
      })
    },
  }
}

function pluginSolidThreadMode(): RsbuildPlugin {
  return {
    name: 'lynx:solid:thread-mode',
    setup(api) {
      api.modifyBundlerChain(chain => {
        const require = createRequire(import.meta.url)
        chain.module
          .rule('solid:thread-mode:main')
          .issuerLayer(LAYERS.MAIN_THREAD)
          .resolve.alias.set(
            '@lynx-js/solid$',
            require.resolve('@lynx-js/solid/main-thread'),
          )
        chain.module
          .rule('solid:thread-mode:background')
          .issuerLayer(LAYERS.BACKGROUND)
          .resolve.alias.set(
            '@lynx-js/solid$',
            require.resolve('@lynx-js/solid/background'),
          )
      })
    },
  }
}

function pluginSolidChunkSplit(): RsbuildPlugin {
  return {
    name: 'lynx:solid:chunk-split',
    setup(api) {
      api.modifyEnvironmentConfig((
        config,
        { name, mergeEnvironmentConfig },
      ) => {
        const original = api.getRsbuildConfig('original')
        const scoped = original.environments?.[name]
        const splitChunks = scoped?.splitChunks ?? original.splitChunks
        const strategy = scoped?.performance?.chunkSplit?.strategy
          ?? original.performance?.chunkSplit?.strategy

        if (
          splitChunks === undefined
          && (strategy === undefined || strategy === 'all-in-one')
        ) {
          return mergeEnvironmentConfig(config, {
            splitChunks: false,
          })
        }
        return config
      })
    },
  }
}

/**
 * Create the Rsbuild integration for SolidLynx.
 *
 * The authored entry is compiled twice. Static JSX fragments emitted by
 * Solid's DOM compiler are extracted into Lynx Element Template metadata.
 * Runtime code instantiates those compiled fragments through the shared
 * Element Template runtime.
 *
 * @public
 */
export function pluginSolidLynx(
  options: PluginSolidLynxOptions = {},
): RsbuildPlugin[] {
  const { elements = [], solid, ...vanillaOptions } = options
  const elementTypes = [...new Set(elements)]

  return [
    pluginBabel(),
    pluginSolid({
      dev: false,
      refresh: { disabled: true },
      solid: {
        ...solid,
        delegateEvents: false,
        generate: 'dom',
        moduleName: '@lynx-js/solid',
      },
    }),
    pluginSolidElementTemplateTransform(),
    pluginSolidChunkSplit(),
    pluginVanillaLynx({
      ...vanillaOptions,
      singleSource: true,
    }),
    pluginSolidThreadMode(),
    pluginSolidElementTemplateMetadata(elementTypes),
  ]
}
