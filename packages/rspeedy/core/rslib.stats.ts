// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface MultiCompilerStatsJson {
  children?: SingleCompilerStatsJson[]
  errors?: unknown[]
  warnings?: unknown[]
  errorsCount?: number
  warningsCount?: number
  [key: string]: unknown
}

export interface SingleCompilerStatsJson {
  name?: string
  assets?: unknown[]
  chunks?: unknown[]
  modules?: unknown[]
  assetsByChunkName?: Record<string, unknown>
  entrypoints?: Record<string, unknown>
  namedChunkGroups?: Record<string, unknown>
  errors?: unknown[]
  warnings?: unknown[]
  errorsCount?: number
  warningsCount?: number
  children?: unknown
  [key: string]: unknown
}

/**
 * Flatten Rspeedy core's multi-compiler stats into a single-compiler stats.
 *
 * `rslib.config.ts` builds several `lib` entries (the main library, the CLI,
 * and the register hooks), so Rspack produces a `MultiCompiler` whose
 * `stats.toJson()` is shaped as `{ children: [...] }` with no top-level
 * `assets`/`chunks`/`modules`. RelativeCI's webpack stats extractor does not
 * support multi-compiler stats and rejects it with "Invalid stats structure".
 *
 * We merge every child compilation into one single-compiler stats so the
 * upload keeps the full published footprint (library + CLI + register bundles).
 * This normalization lives here — alongside the config that owns the
 * RelativeCI upload — rather than in the shared `lynx:stats-json` plugin, so
 * that the `stats.json` emitted for regular Rspeedy projects is left untouched.
 *
 * @param statsJson - The raw stats object from `stats.toJson()`.
 * @returns A single-compiler-shaped stats object accepted by RelativeCI.
 */
export function toSingleCompilerStats(
  statsJson: MultiCompilerStatsJson,
): SingleCompilerStatsJson {
  const children = statsJson.children
  if (!Array.isArray(children) || children.length === 0) {
    return statsJson as SingleCompilerStatsJson
  }

  const [first] = children
  const merged: SingleCompilerStatsJson = {
    ...first,
    assets: children.flatMap(child => child.assets ?? []),
    chunks: children.flatMap(child => child.chunks ?? []),
    modules: children.flatMap(child => child.modules ?? []),
    assetsByChunkName: mergeRecords(
      children.map(child => child.assetsByChunkName),
    ),
    entrypoints: mergeRecords(children.map(child => child.entrypoints)),
    namedChunkGroups: mergeRecords(
      children.map(child => child.namedChunkGroups),
    ),
    errors: children.flatMap(child => child.errors ?? []),
    warnings: children.flatMap(child => child.warnings ?? []),
    errorsCount: children.reduce(
      (count, child) => count + (child.errorsCount ?? 0),
      0,
    ),
    warningsCount: children.reduce(
      (count, child) => count + (child.warningsCount ?? 0),
      0,
    ),
  }

  delete merged.name
  delete merged.children

  return merged
}

/**
 * Shallow-merge a list of optional keyed maps into a single record.
 *
 * @param records - The per-child maps (any of which may be `undefined`).
 * @returns A single record containing every entry.
 */
function mergeRecords(
  records: Array<Record<string, unknown> | undefined>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const record of records) {
    if (record) {
      Object.assign(result, record)
    }
  }
  return result
}
