// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DEBUG_METADATA_ASSET_NAME } from './constants.js'

const SOURCE_MAPPING_URL_TRAILER =
  /(?:\/\/[#@]\s*sourceMappingURL=(\S+)|\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\/)\s*$/

/**
 * Replace the trailing `//# sourceMappingURL=...` (or block-comment form)
 * with `newUrl`. Returns the new source string, or `undefined` when the
 * trailer is absent, points at a `data:` URI, or already references the
 * debug-metadata container (a previous pass already rewrote it).
 *
 * @internal Exported for unit testing only.
 */
export function rewriteTrailerToUrl(
  source: string,
  newUrl: string,
): string | undefined {
  const match = SOURCE_MAPPING_URL_TRAILER.exec(source)
  if (!match) return undefined
  const isBlockComment = match[2] !== undefined
  const originalUrl = isBlockComment ? match[2] : match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined
  const trailer = isBlockComment
    ? `/*# sourceMappingURL=${newUrl}*/`
    : `//# sourceMappingURL=${newUrl}`
  return source.slice(0, match.index) + trailer
}

/**
 * Default URL builder used by the dev-server path: rewrites the trailer to
 * point at the local-or-uploaded debug-metadata container, asking the
 * container's host for the `source-map` field of the given `mapAssetPath`.
 * Assumes `metadataUrl` is query-less.
 *
 * @internal Exported for unit testing only.
 */
export function rewriteTrailerToAbsoluteUrl(
  source: string,
  metadataUrl: string,
  mapAssetPath: string,
): string | undefined {
  return rewriteTrailerToUrl(
    source,
    `${metadataUrl}?field=source-map&path=${encodeURIComponent(mapAssetPath)}`,
  )
}
