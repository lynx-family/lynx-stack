// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compilation, Compiler } from 'webpack'

import { DEBUG_METADATA_ASSET_NAME } from './constants.js'

/**
 * Match a trailing `//# sourceMappingURL=…` (or `//@ …`) comment and
 * capture the URL portion. Anchored to end-of-string with no `/m` so
 * only the final trailer is matched — bundlers commonly inline inner
 * module bodies that themselves contain `sourceMappingURL` comments,
 * and we must not touch those.
 */
const SOURCE_MAPPING_URL_TRAILER = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/

/**
 * Tap `processAssets` to rewrite each JS asset's `//# sourceMappingURL=`
 * trailer so it points at the unified `debug-metadata.json` endpoint.
 *
 * The original URL's dir part is preserved verbatim — whatever
 * `SourceMapDevToolPlugin` (or `output.publicPath`, or a user-supplied
 * `filename` / `append` option) wrote is the source of truth for
 * "where the dev server will serve this asset from". We only swap the
 * trailing `.map` filename for a metadata-endpoint query:
 *
 * ```
 * <dir from original URL>debug-metadata.json?field=source-map&filename=<original .map basename>
 * ```
 *
 * Runs at `PROCESS_ASSETS_STAGE_DEV_TOOLING + 1`, immediately after
 * devtool writes the original trailer and before
 * `LynxTemplatePlugin`'s `OPTIMIZE_HASH`-staged encode pass reads the
 * JS source — so the encoded template carries the rewritten URL too.
 */
export function applySourceMappingURLRewriter(
  compiler: Compiler,
  compilation: Compilation,
): void {
  const { Compilation, sources } = compiler.webpack
  const { RawSource } = sources

  compilation.hooks.processAssets.tap(
    {
      name: 'LynxDebugMetadataPlugin/source-mapping-url-rewriter',
      stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING + 1,
    },
    () => {
      for (const name of Object.keys(compilation.assets)) {
        if (!name.endsWith('.js')) continue
        const asset = compilation.getAsset(name)
        if (!asset) continue
        const before = asset.source.source().toString()
        const after = rewriteTrailer(before)
        if (after === undefined) continue
        compilation.updateAsset(name, new RawSource(after), asset.info)
      }
    },
  )
}

/**
 * Return the rewritten source, or `undefined` when there's no trailer
 * to rewrite, the trailer is a `data:` URL, or it already points at
 * `debug-metadata.json` (idempotent).
 *
 * URL surgery is intentionally done with **string manipulation rather
 * than `new URL`**: WHATWG URL normalization collapses `..` segments
 * (`new URL('../maps/x.map', base).pathname` → `/maps/x.map`), but
 * `SourceMapDevToolPlugin` users can write relative trailers like
 * `../maps/<name>.js.map` and we must preserve the dir verbatim so the
 * dev server / metadata endpoint can resolve back to the same asset.
 *
 *  1. Strip `?…` query and `#…` fragment off the original URL.
 *  2. Split on the last `/` to get `dir` + `encodedBasename`.
 *  3. Build the new URL as
 *     `<dir>debug-metadata.json?field=source-map&filename=<decoded basename>`.
 *
 * @internal Exported for unit testing only.
 */
export function rewriteTrailer(source: string): string | undefined {
  const match = SOURCE_MAPPING_URL_TRAILER.exec(source)
  if (!match) return undefined
  const originalUrl = match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined

  const noHash = originalUrl.split('#', 1)[0]!
  const encodedPath = noHash.split('?', 1)[0]!
  const lastSlash = encodedPath.lastIndexOf('/')
  const encodedBasename = encodedPath.slice(lastSlash + 1)
  if (!encodedBasename) return undefined
  let decodedBasename: string
  try {
    decodedBasename = decodeURIComponent(encodedBasename)
  } catch {
    decodedBasename = encodedBasename
  }
  const dir = lastSlash >= 0 ? encodedPath.slice(0, lastSlash + 1) : ''
  const newUrl =
    `${dir}${DEBUG_METADATA_ASSET_NAME}?field=source-map&filename=${
      encodeURIComponent(decodedBasename)
    }`

  return source.slice(0, match.index) + `//# sourceMappingURL=${newUrl}`
}
