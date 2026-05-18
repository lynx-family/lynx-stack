// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'

import type { RsbuildEntry } from '@rsbuild/core'
import type { Compilation, Compiler } from 'webpack'

import type {
  DebugMetadataAsset,
  GitMetadata,
  RspeedyMeta,
} from '@lynx-js/debug-metadata'
import type { LynxTemplatePlugin as LynxTemplatePluginClass } from '@lynx-js/template-webpack-plugin'

import { collectArtifacts } from './collectors/artifacts.js'
import { parseLepusNGDebugInfo } from './collectors/bytecode-debug-info.js'
import { collectEntryPathMap, dedupe } from './collectors/entries.js'
import { collectGitMetadata } from './collectors/git.js'
import {
  collectUiSourceMapRecords,
  createUiSourceMap,
} from './collectors/ui-source-map.js'
import { DEBUG_METADATA_ASSET_NAME } from './constants.js'
import { applySourceMappingURLRewriter } from './source-mapping-url-rewriter.js'

/**
 * The options of the {@link LynxDebugMetadataPlugin}.
 *
 * @public
 */
export interface LynxDebugMetadataPluginOptions {
  /**
   * The name of the debug metadata asset.
   *
   * @defaultValue 'debug-metadata.json'
   */
  debugMetadataAssetName?: string
  /**
   * The LynxTemplatePlugin class.
   */
  LynxTemplatePlugin: typeof LynxTemplatePluginClass
  /**
   * The rsbuild environment's `entry`. Used to populate
   * `meta.rspeedy.entryFiles`. When omitted (e.g. when the webpack
   * plugin is applied outside of an rsbuild pipeline),
   * `meta.rspeedy.entryFiles` is empty.
   */
  rsbuildEntry?: RsbuildEntry
}

/**
 * The LynxDebugMetadataPlugin is a webpack plugin that adds debug metadata to the output.
 *
 * @public
 */
export class LynxDebugMetadataPlugin {
  constructor(protected options?: LynxDebugMetadataPluginOptions | undefined) {}
  /**
   * `defaultOptions` is the default options that the {@link LynxDebugMetadataPlugin} uses.
   *
   * @example
   * `defaultOptions` can be used to change part of the option and keep others as the default value.
   *
   * ```js
   * // webpack.config.js
   * import { LynxDebugMetadataPlugin } from '@lynx-js/debug-metadata-rsbuild-plugin'
   * export default {
   *   plugins: [
   *     new LynxDebugMetadataPlugin({
   *       ...LynxDebugMetadataPlugin.defaultOptions,
   *       debugMetadataAssetName: DEBUG_METADATA_ASSET_NAME,
   *     }),
   *   ],
   * }
   * ```
   *
   * @public
   */
  static defaultOptions: Readonly<
    Omit<
      Required<LynxDebugMetadataPluginOptions>,
      'LynxTemplatePlugin' | 'rsbuildEntry'
    >
  > = Object
    .freeze<
      Omit<
        Required<LynxDebugMetadataPluginOptions>,
        'LynxTemplatePlugin' | 'rsbuildEntry'
      >
    >({
      debugMetadataAssetName: DEBUG_METADATA_ASSET_NAME,
    })
  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new LynxDebugMetadataPluginImpl(
      compiler,
      Object.assign({}, LynxDebugMetadataPlugin.defaultOptions, this.options),
    )
  }
}

export class LynxDebugMetadataPluginImpl {
  name = 'LynxDebugMetadataPlugin'
  constructor(
    protected compiler: Compiler,
    protected options: LynxDebugMetadataPluginOptions,
  ) {
    this.options = options

    const { RawSource } = compiler.webpack.sources

    let gitCache: GitMetadata | null | undefined
    const getGit = (): GitMetadata | null => {
      if (gitCache === undefined) {
        gitCache = collectGitMetadata(compiler.context)
      }
      return gitCache
    }

    let entryPathMapCache: Record<string, string[]> | undefined
    const getEntryPathMap = (): Record<string, string[]> => {
      entryPathMapCache ??= this.options.rsbuildEntry
        ? collectEntryPathMap(
          this.options.rsbuildEntry,
          compiler.context,
          getGit()?.rootDir ?? null,
        )
        : {}
      return entryPathMapCache
    }

    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      const templateHooks = this.options.LynxTemplatePlugin
        .getLynxTemplatePluginHooks(
          compilation,
        )

      applySourceMappingURLRewriter(compiler, compilation)

      templateHooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const uiSourceMapRecords = collectUiSourceMapRecords(
            compilation,
            args.entryNames,
          )
          const git = getGit()
          const entryPathMap = getEntryPathMap()
          const rspeedy: RspeedyMeta = {
            entryFiles: dedupe(
              args.entryNames.flatMap(name => entryPathMap[name] ?? []),
            ),
            bundlePath: args.filenameTemplate,
          }
          const asset: DebugMetadataAsset = {
            artifacts: collectArtifacts(compilation, args.entryNames),
            uiSourceMap: createUiSourceMap(uiSourceMapRecords),
            meta: {
              ...(git ? { git } : {}),
              rspeedy,
            },
          }
          const debugMetadataAssetName = path.posix.format({
            dir: args.intermediate,
            base: this.options.debugMetadataAssetName,
          })
          compilation.emitAsset(
            debugMetadataAssetName,
            new RawSource(JSON.stringify(asset, null, 2)),
          )
          args.intermediateAssets.push(debugMetadataAssetName)

          return args
        },
      )

      templateHooks.beforeEmit.tap(
        this.constructor.name,
        (args) => {
          const firstMainThread = args.mainThreadAssets[0]
          if (!firstMainThread) return args
          const intermediate = path.posix.dirname(
            firstMainThread.name.replace(/\\/g, '/'),
          )
          const debugMetadataAssetName = path.posix.format({
            dir: intermediate,
            base: this.options.debugMetadataAssetName,
          })

          const existing = compilation.getAsset(debugMetadataAssetName)
          if (!existing) return args

          let metadata: DebugMetadataAsset
          try {
            metadata = JSON.parse(
              existing.source.source().toString(),
            ) as DebugMetadataAsset
          } catch {
            return args
          }

          for (const artifact of metadata.artifacts) {
            const section = readTasmSection(compilation, artifact.path)
            if (section) artifact.tasmSection = section
          }

          const lepusNG = parseLepusNGDebugInfo(args.debugInfo)
          if (lepusNG) {
            const target = metadata.artifacts.find(a =>
              a.kind === 'main-thread'
              && a.tasmSection?.[0] === 'lepusCode'
              && a.tasmSection?.[1] === 'root'
            ) ?? metadata.artifacts.find(a => a.kind === 'main-thread')
            if (target) {
              target.debugSources.unshift({
                kind: 'bytecode-debug-info',
                debugInfo: lepusNG,
              })
            }
          }

          compilation.updateAsset(
            debugMetadataAssetName,
            new RawSource(JSON.stringify(metadata, null, 2)),
          )

          return args
        },
      )
    })
  }
}

/**
 * Read the `'lynx:tasm-section'` info `LynxEncodePlugin` stamps on every
 * routed asset. Returns `undefined` when the encoder did not (yet) mark
 * this asset — leaving `Artifact.tasmSection` unset is preferable to
 * guessing the wrong path.
 */
function readTasmSection(
  compilation: Compilation,
  assetName: string,
): string[] | undefined {
  const value: unknown = compilation.getAsset(assetName)?.info
    ?.['lynx:tasm-section']
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === 'string')
    : undefined
}
