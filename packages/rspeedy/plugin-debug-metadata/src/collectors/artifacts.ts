// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { Chunk, Compilation } from 'webpack'

import type {
  Artifact,
  SourceMap,
  SourceMapDebugSource,
} from '@lynx-js/debug-metadata'

/**
 * Walk the chunks contributing to `entryNames` and collect a
 * {@link Artifact} per JS / CSS asset that has a sibling Source Map v3
 * file in `compilation.assets`. Assets without a map (devtool disabled,
 * eval-only, runtime helpers, etc.) are skipped silently.
 */
export function collectArtifacts(
  compilation: Compilation,
  entryNames: string[],
): Artifact[] {
  const artifacts: Artifact[] = []
  const seen = new Set<string>()

  for (const entryName of entryNames) {
    const chunkGroup = compilation.namedChunkGroups.get(entryName)
      ?? compilation.entrypoints.get(entryName)
    if (!chunkGroup) continue

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
            key: extractKey(chunk, file),
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
  compilation: Compilation,
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
 * Identifier used by reverse-symbolication services to match a map.
 *
 * - JS assets use `chunk.hash` so the value matches the
 *   `__SOURCEMAP_RELEASE__` banner `SlardarWebpackPlugin` bakes into
 *   the top of the JS at build time.
 * - CSS assets use `chunk.contentHash.css` instead — `chunk.hash`
 *   would collide with the sibling JS asset's key when a single chunk
 *   produces both `*.js` and `*.css` (as MiniCssExtractPlugin does),
 *   and CSS has no equivalent baked-in release identifier that forces
 *   the same value as the JS one.
 */
function extractKey(chunk: Chunk, file: string): string {
  if (file.endsWith('.css')) {
    return chunk.contentHash?.['css/mini-extract']
      ?? chunk.contentHash?.['css']
      ?? chunk.hash
      ?? ''
  }
  return chunk.hash ?? ''
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
  compilation: Compilation,
  assetName: string,
): Artifact['kind'] {
  if (assetName.endsWith('.css')) return 'css'
  const info = compilation.getAsset(assetName)?.info
  return info?.['lynx:main-thread'] === true ? 'main-thread' : 'background'
}
