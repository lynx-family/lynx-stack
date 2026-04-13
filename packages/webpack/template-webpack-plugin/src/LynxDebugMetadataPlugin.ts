// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import type { Compilation, Compiler } from 'webpack';

import type { LynxTemplatePlugin as LynxTemplatePluginClass } from './LynxTemplatePlugin.js';

export const DEBUG_METADATA_ASSET_NAME = 'debug-metadata.json';

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
  debugMetadataAssetName?: string;
  /**
   * The LynxTemplatePlugin class.
   */
  LynxTemplatePlugin: typeof LynxTemplatePluginClass;
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
   * import { LynxDebugMetadataPlugin } from '@lynx-js/template-webpack-plugin'
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
    Omit<Required<LynxDebugMetadataPluginOptions>, 'LynxTemplatePlugin'>
  > = Object
    .freeze<
      Omit<Required<LynxDebugMetadataPluginOptions>, 'LynxTemplatePlugin'>
    >({
      debugMetadataAssetName: DEBUG_METADATA_ASSET_NAME,
    });
  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new LynxDebugMetadataPluginImpl(
      compiler,
      Object.assign({}, LynxDebugMetadataPlugin.defaultOptions, this.options),
    );
  }
}

export class LynxDebugMetadataPluginImpl {
  name = 'LynxDebugMetadataPlugin';
  constructor(
    protected compiler: Compiler,
    protected options: LynxDebugMetadataPluginOptions,
  ) {
    this.options = options;

    const { RawSource } = compiler.webpack.sources;

    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      const templateHooks = this.options.LynxTemplatePlugin
        .getLynxTemplatePluginHooks(
          compilation,
        );

      templateHooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const uiSourceMapRecords = collectUiSourceMapRecords(
            compilation,
            args.entryNames,
          );
          const debugMetadataAssetName = path.posix.format({
            dir: args.intermediate,
            base: this.options.debugMetadataAssetName,
          });
          compilation.emitAsset(
            debugMetadataAssetName,
            new RawSource(
              JSON.stringify(
                createDebugMetadataAsset(
                  uiSourceMapRecords,
                ),
                null,
                2,
              ),
            ),
          );
          args.intermediateAssets.push(debugMetadataAssetName);

          return args;
        },
      );
    });
  }
}

export const UI_SOURCE_MAP_RECORDS_BUILD_INFO = 'lynxUiSourceMapRecords';

export interface UiSourceMapRecord {
  uiSourceMap: number;
  filename: string;
  lineNumber: number;
  columnNumber: number;

  [key: string]: unknown;
}

interface UiSourceMapData {
  version: 1;
  sources: string[];
  mappings: [number, number, number][];
  uiMaps: number[];
}

interface DebugMetadataAsset {
  uiSourceMap: UiSourceMapData;
  meta: Record<string, unknown>;
}

export interface ModuleWithUiSourceMapBuildInfo {
  identifier?: () => string;
  buildInfo?: Record<string, unknown>;
  modules?: Iterable<ModuleWithUiSourceMapBuildInfo>;
}

export function collectUiSourceMapRecordsFromModule(
  module: ModuleWithUiSourceMapBuildInfo,
): UiSourceMapRecord[] {
  const uiSourceMapRecords: UiSourceMapRecord[] = [];
  if (Array.isArray(module.buildInfo?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO])) {
    uiSourceMapRecords.push(
      ...module.buildInfo
        ?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO] as UiSourceMapRecord[],
    );
  }

  if (module.modules) {
    Array.from(module.modules)
      .forEach(nestedModule => {
        uiSourceMapRecords.push(
          ...collectUiSourceMapRecordsFromModule(nestedModule),
        );
      });
  }

  return uiSourceMapRecords;
}

export function compareUiSourceMapRecord(
  a: UiSourceMapRecord,
  b: UiSourceMapRecord,
): number {
  return a.filename.localeCompare(b.filename)
    || a.lineNumber - b.lineNumber
    || a.columnNumber - b.columnNumber
    || a.uiSourceMap - b.uiSourceMap;
}

export function createUiSourceMap(
  uiSourceMapRecords: UiSourceMapRecord[],
): UiSourceMapData {
  const sources: string[] = [];
  const sourceIndexes = new Map<string, number>();
  const mappings: [number, number, number][] = [];
  const uiMaps: number[] = [];

  for (const record of uiSourceMapRecords) {
    if (!record.filename) {
      continue;
    }
    const sourceIndex = sourceIndexes.get(record.filename) ?? sources.length;

    if (!sourceIndexes.has(record.filename)) {
      sourceIndexes.set(record.filename, sourceIndex);
      sources.push(record.filename);
    }

    mappings.push([
      sourceIndex,
      record.lineNumber,
      record.columnNumber,
    ]);
    uiMaps.push(record.uiSourceMap);
  }

  return {
    version: 1,
    sources,
    mappings,
    uiMaps,
  };
}

export function createDebugMetadataAsset(
  uiSourceMapRecords: UiSourceMapRecord[],
): DebugMetadataAsset {
  return {
    uiSourceMap: createUiSourceMap(uiSourceMapRecords),
    meta: {},
  };
}

export function collectUiSourceMapRecords(
  compilation: Compilation,
  entryNames: string[],
): UiSourceMapRecord[] {
  const moduleSet = new Set<ModuleWithUiSourceMapBuildInfo>();

  for (const entryName of entryNames) {
    const chunkGroup = compilation.namedChunkGroups.get(entryName)
      ?? compilation.entrypoints.get(entryName);
    if (!chunkGroup) {
      continue;
    }

    for (const chunk of chunkGroup.chunks) {
      for (
        const module of compilation.chunkGraph.getChunkModulesIterable(chunk)
      ) {
        moduleSet.add(module as ModuleWithUiSourceMapBuildInfo);
      }
    }
  }

  const deduped = new Map<string, UiSourceMapRecord>();
  for (const module of moduleSet) {
    for (const record of collectUiSourceMapRecordsFromModule(module)) {
      const key = [
        record.uiSourceMap,
        record.filename,
        record.lineNumber,
        record.columnNumber,
      ].join(':');
      deduped.set(key, record);
    }
  }

  return Array.from(deduped.values()).sort(compareUiSourceMapRecord);
}
