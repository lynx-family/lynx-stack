// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { Rspack } from '@rsbuild/core'

import type {
  Artifact,
  SourceMap,
  SourceMapDebugSource,
} from '@lynx-js/debug-metadata'

import { computeChunkReleaseKey, computeReleaseKey } from '../release-banner.js'

/**
 * Walk the chunks contributing to `entryNames` and collect a
 * {@link Artifact} per JS / CSS asset that has a sibling Source Map v3
 * file in `compilation.assets`. Assets without a map (devtool disabled,
 * eval-only, runtime helpers, etc.) are skipped silently.
 */
export function collectArtifacts(
  compilation: Rspack.Compilation,
  chunkGroups: Rspack.ChunkGroup[],
): Artifact[] {
  const artifacts: Artifact[] = []
  const seen = new Set<string>()

  for (const chunkGroup of chunkGroups) {
    for (const chunk of chunkGroup.chunks) {
      for (const file of chunk.files) {
        if (!isMappableAsset(file)) continue
        if (seen.has(file)) continue
        seen.add(file)

        const kind = inferKind(compilation, file)
        const debugSources: SourceMapDebugSource[] = []
        const mapPath = `${file}.map`
        const map = readSourceMap(compilation, mapPath)
        if (map) {
          debugSources.push({
            kind: 'source-map',
            filename: path.posix.basename(mapPath),
            path: mapPath,
            key: extractKey(compilation.chunkGraph, chunk, file),
            map,
          })
        } else if (kind === 'css') {
          // CSS assets with no sibling `.map` carry no useful debug
          // info — skip rather than emit an empty entry. JS assets
          // still need to be emitted: `LynxEncodePlugin`'s lepusNG
          // bytecode-debug-info is attached to the main-thread artifact
          // in `beforeEmit`, so we have to keep a JS artifact around
          // even when sibling source maps are disabled
          // (`output.sourceMap: false`).
          continue
        }
        artifacts.push({
          kind,
          filename: path.posix.basename(file),
          path: file,
          debugSources,
        })
      }
    }
  }

  return artifacts
}

function isMappableAsset(file: string): boolean {
  return file.endsWith('.js') || file.endsWith('.css')
}

function readSourceMap(
  compilation: Rspack.Compilation,
  mapAssetName: string,
): SourceMap | undefined {
  const asset = compilation.getAsset(mapAssetName)
  if (!asset) return undefined
  try {
    return JSON.parse(asset.source.source().toString()) as SourceMap
  } catch {
    return undefined
  }
}

/**
 * Unique key used by remapping services to match a map — a 160-bit
 * {@link computeChunkReleaseKey} over the chunk's module content.
 *
 * - JS assets use the chunk key directly, matching the
 *   `__DEBUG_METADATA_RELEASE__` banner this plugin bakes into the top of the
 *   JS at build time (both call {@link computeChunkReleaseKey} on the chunk).
 * - CSS assets append a `'css'` discriminator — a chunk that emits both `*.js`
 *   and `*.css` (as MiniCssExtractPlugin does) shares one set of modules, so
 *   the bare chunk key would collide between the two; CSS has no banner that
 *   must match it.
 */
function extractKey(
  chunkGraph: Rspack.Compilation['chunkGraph'],
  chunk: Rspack.Chunk,
  file: string,
): string {
  const chunkKey = computeChunkReleaseKey(chunkGraph, chunk)
  return file.endsWith('.css') ? computeReleaseKey(chunkKey, 'css') : chunkKey
}

/**
 * Map an emitted asset back to the {@link Artifact.kind} bucket:
 *
 * - `.css` → `'css'` (routed to the CSS section in `tasm.json`).
 * - JS with `info['lynx:main-thread'] === true` → `'main-thread'`
 *   (compiled into the `lepusCode` section). The flag is written by
 *   `ReactWebpackPlugin` for every asset that should be encoded as
 *   main-thread JS.
 * - Anything else → `'background'`.
 */
function inferKind(
  compilation: Rspack.Compilation,
  assetName: string,
): Artifact['kind'] {
  if (assetName.endsWith('.css')) return 'css'
  const info = compilation.getAsset(assetName)?.info
  return info?.['lynx:main-thread'] === true ? 'main-thread' : 'background'
}
