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
  UiSourceMapData,
} from '@lynx-js/debug-metadata'
import type { LynxTemplatePlugin as LynxTemplatePluginClass } from '@lynx-js/template-webpack-plugin'

import { collectGitMetadata } from './git.js'
import { collectEntryPathMap, dedupe } from './rspeedy-meta.js'
import { collectArtifacts } from './source-maps.js'
import { UI_SOURCE_MAP_RECORDS_BUILD_INFO } from './UiSourceMapBuildInfo.js'
import type { UiSourceMapRecord } from './UiSourceMapBuildInfo.js'

/**
 * Default name of the debug metadata asset emitted alongside each template.
 *
 * @public
 */
export const DEBUG_METADATA_ASSET_NAME = 'debug-metadata.json'

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
    })
  }
}

export interface ModuleWithUiSourceMapBuildInfo {
  identifier?: () => string
  buildInfo?: Record<string, unknown>
  modules?: Iterable<ModuleWithUiSourceMapBuildInfo>
}

export function collectUiSourceMapRecordsFromModule(
  module: ModuleWithUiSourceMapBuildInfo,
): UiSourceMapRecord[] {
  const uiSourceMapRecords: UiSourceMapRecord[] = []
  if (Array.isArray(module.buildInfo?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO])) {
    uiSourceMapRecords.push(
      ...module.buildInfo
        ?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO] as UiSourceMapRecord[],
    )
  }

  if (module.modules) {
    Array.from(module.modules)
      .forEach(nestedModule => {
        uiSourceMapRecords.push(
          ...collectUiSourceMapRecordsFromModule(nestedModule),
        )
      })
  }

  return uiSourceMapRecords
}

export function compareUiSourceMapRecord(
  a: UiSourceMapRecord,
  b: UiSourceMapRecord,
): number {
  return a.filename.localeCompare(b.filename)
    || a.lineNumber - b.lineNumber
    || a.columnNumber - b.columnNumber
    || a.uiSourceMap - b.uiSourceMap
}

export function createUiSourceMap(
  uiSourceMapRecords: UiSourceMapRecord[],
): UiSourceMapData {
  const sources: string[] = []
  const sourceIndexes = new Map<string, number>()
  const mappings: [number, number, number][] = []
  const uiMaps: number[] = []

  for (const record of uiSourceMapRecords) {
    if (!record.filename) {
      continue
    }
    const sourceIndex = sourceIndexes.get(record.filename) ?? sources.length

    if (!sourceIndexes.has(record.filename)) {
      sourceIndexes.set(record.filename, sourceIndex)
      sources.push(record.filename)
    }

    mappings.push([
      sourceIndex,
      record.lineNumber,
      record.columnNumber,
    ])
    uiMaps.push(record.uiSourceMap)
  }

  return {
    version: 1,
    sources,
    mappings,
    uiMaps,
  }
}

export function collectUiSourceMapRecords(
  compilation: Compilation,
  entryNames: string[],
): UiSourceMapRecord[] {
  const moduleSet = new Set<ModuleWithUiSourceMapBuildInfo>()

  for (const entryName of entryNames) {
    const chunkGroup = compilation.namedChunkGroups.get(entryName)
      ?? compilation.entrypoints.get(entryName)
    if (!chunkGroup) {
      continue
    }

    for (const chunk of chunkGroup.chunks) {
      for (
        const module of compilation.chunkGraph.getChunkModulesIterable(chunk)
      ) {
        moduleSet.add(module as ModuleWithUiSourceMapBuildInfo)
      }
    }
  }

  const deduped = new Map<string, UiSourceMapRecord>()
  for (const module of moduleSet) {
    for (const record of collectUiSourceMapRecordsFromModule(module)) {
      const key = [
        record.uiSourceMap,
        record.filename,
        record.lineNumber,
        record.columnNumber,
      ].join(':')
      deduped.set(key, record)
    }
  }

  return Array.from(deduped.values()).sort(compareUiSourceMapRecord)
}
