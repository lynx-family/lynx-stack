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

        const map = readSourceMap(compilation, `${file}.map`)
        if (!map) continue

        const debugSource: SourceMapDebugSource = {
          kind: 'source-map',
          path: `${file}.map`,
          key: extractKey(chunk, file),
          map,
        }
        const kind = inferKind(compilation, file)
        artifacts.push({
          kind,
          filename: path.posix.basename(file),
          path: file,
          tasmSection: inferTasmSection(kind, file),
          debugSources: [debugSource],
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
/**
 * Place the artifact inside `tasm.json`:
 *
 * - `css`         → `['css']`
 * - `main-thread` → `['lepusCode', 'root']`
 * - `background`  → `['manifest', '/' + assetName]` — the real `tasm.json`
 *   keys under `manifest` carry a leading `/` (e.g.
 *   `/.rspeedy/main/background.fd311de1.js`).
 */
function inferTasmSection(
  kind: Artifact['kind'],
  assetName: string,
): string[] {
  if (kind === 'css') return ['css']
  if (kind === 'main-thread') return ['lepusCode', 'root']
  return ['manifest', `/${assetName}`]
}

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
