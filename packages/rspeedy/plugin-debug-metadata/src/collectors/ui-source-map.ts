// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'

import { UI_SOURCE_MAP_RECORDS_BUILD_INFO } from '@lynx-js/debug-metadata'
import type {
  UiSourceMapData,
  UiSourceMapRecord,
} from '@lynx-js/debug-metadata'

/**
 * Minimal structural shape this collector needs from a module — enough to
 * walk `buildInfo` and recurse into a concatenated module's children.
 */
export interface ModuleWithUiSourceMapBuildInfo {
  identifier?: () => string
  buildInfo?: Record<string, unknown>
  modules?: Iterable<ModuleWithUiSourceMapBuildInfo>
}

/**
 * Pull every {@link UiSourceMapRecord} the main-thread loader stashed on
 * `module.buildInfo[UI_SOURCE_MAP_RECORDS_BUILD_INFO]`, recursing into
 * concatenated modules to surface records hidden inside merged units.
 */
export function collectUiSourceMapRecordsFromModule(
  module: ModuleWithUiSourceMapBuildInfo,
): UiSourceMapRecord[] {
  const records: UiSourceMapRecord[] = []
  const value = module.buildInfo?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO]
  if (Array.isArray(value)) {
    records.push(...(value as UiSourceMapRecord[]))
  }
  if (module.modules) {
    for (const nested of module.modules) {
      records.push(...collectUiSourceMapRecordsFromModule(nested))
    }
  }
  return records
}

/**
 * Deterministic ordering for {@link UiSourceMapRecord}s — primary by
 * filename (case-insensitive), then line, then column, then the
 * runtime-side `uiSourceMap` discriminator. Used to make snapshot output
 * stable across builds.
 */
export function compareUiSourceMapRecord(
  a: UiSourceMapRecord,
  b: UiSourceMapRecord,
): number {
  return a.filename.localeCompare(b.filename)
    || a.lineNumber - b.lineNumber
    || a.columnNumber - b.columnNumber
    || a.uiSourceMap - b.uiSourceMap
}

/**
 * Build the compact {@link UiSourceMapData} payload emitted under
 * `DebugMetadataAsset.uiSourceMap`. Records without a `filename` are
 * dropped (no source to anchor the entry to).
 */
export function createUiSourceMap(
  records: UiSourceMapRecord[],
): UiSourceMapData {
  const sources: string[] = []
  const sourceIndexes = new Map<string, number>()
  const mappings: [number, number, number][] = []
  const uiMaps: number[] = []

  for (const record of records) {
    if (!record.filename) continue
    let sourceIndex = sourceIndexes.get(record.filename)
    if (sourceIndex === undefined) {
      sourceIndex = sources.length
      sourceIndexes.set(record.filename, sourceIndex)
      sources.push(record.filename)
    }
    mappings.push([sourceIndex, record.lineNumber, record.columnNumber])
    uiMaps.push(record.uiSourceMap)
  }

  return { version: 1, sources, mappings, uiMaps }
}

/**
 * Walk the modules contributing to `entryNames` and return every
 * {@link UiSourceMapRecord} produced by the main-thread loader,
 * de-duplicated by `(uiSourceMap, filename, line, column)` and sorted by
 * {@link compareUiSourceMapRecord}.
 */
export function collectUiSourceMapRecords(
  compilation: Rspack.Compilation,
  chunkGroups: Rspack.ChunkGroup[],
): UiSourceMapRecord[] {
  const moduleSet = new Set<ModuleWithUiSourceMapBuildInfo>()

  for (const chunkGroup of chunkGroups) {
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
