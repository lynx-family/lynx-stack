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
 *
 * The URL itself is parsed by {@link rewriteTrailer} using `new URL`,
 * not by this regex, so query strings / fragments / encoded chars do
 * not require special handling here.
 */
const SOURCE_MAPPING_URL_TRAILER = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/

const PLACEHOLDER_BASE = 'http://__lynx-debug-metadata-placeholder__/'
const PLACEHOLDER_ORIGIN = new URL(PLACEHOLDER_BASE).origin

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
        if (!compilation.getAsset(`${name}.map`)) continue
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
 * @internal Exported for unit testing only.
 *
 * URL surgery is delegated to `new URL` so query strings, fragments,
 * percent-encoding, and absolute vs. relative forms are all handled
 * by the WHATWG URL parser instead of by us:
 *
 *  1. Parse `originalUrl` against a placeholder base so relative URLs
 *     get a well-defined `pathname`.
 *  2. Replace the last path segment with `debug-metadata.json`.
 *  3. Set `search` to `?field=source-map&filename=<original basename>`,
 *     overwriting any pre-existing query and stripping any fragment.
 *  4. Re-serialize, peeling the placeholder back off so relative input
 *     stays relative.
 */
export function rewriteTrailer(source: string): string | undefined {
  const match = SOURCE_MAPPING_URL_TRAILER.exec(source)
  if (!match) return undefined
  const originalUrl = match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined

  let parsed: URL
  try {
    parsed = new URL(originalUrl, PLACEHOLDER_BASE)
  } catch {
    return undefined
  }

  const segments = parsed.pathname.split('/')
  const mapBasename = segments.pop()
  if (!mapBasename) return undefined
  segments.push(DEBUG_METADATA_ASSET_NAME)
  parsed.pathname = segments.join('/')
  parsed.search = `?field=source-map&filename=${
    encodeURIComponent(mapBasename)
  }`
  parsed.hash = ''

  let newUrl: string
  if (parsed.origin === PLACEHOLDER_ORIGIN) {
    newUrl = parsed.pathname + parsed.search
    if (!originalUrl.startsWith('/')) newUrl = newUrl.replace(/^\//, '')
  } else {
    newUrl = parsed.toString()
  }

  return source.slice(0, match.index) + `//# sourceMappingURL=${newUrl}`
}
