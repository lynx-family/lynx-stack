// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DEBUG_METADATA_ASSET_NAME } from './constants.js'

const SOURCE_MAPPING_URL_RE =
  /(?:\/\/[#@]\s*sourceMappingURL=(\S+)|\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\/)\s*$/

/**
 * Replace the trailing `//# sourceMappingURL=...` (or block-comment form)
 * with `newUrl`. Returns the new source string, or `undefined` when the
 * directive is absent or points at a `data:` URI. Consumer-supplied URLs
 * always overwrite — no idempotency guard at this layer, so a consumer
 * callback can replace a URL the default flow baked first.
 *
 * @internal Exported for unit testing only.
 */
export function rewriteSourceMappingURL(
  source: string,
  newUrl: string,
): string | undefined {
  const match = SOURCE_MAPPING_URL_RE.exec(source)
  if (!match) return undefined
  const isBlockComment = match[2] !== undefined
  const originalUrl = isBlockComment ? match[2] : match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  const directive = isBlockComment
    ? `/*# sourceMappingURL=${newUrl}*/`
    : `//# sourceMappingURL=${newUrl}`
  return source.slice(0, match.index) + directive
}

/**
 * Default URL builder used by the dev-server path: rewrites the
 * sourceMappingURL to point at the local-or-uploaded debug-metadata
 * container, asking the container's host for the `source-map` field of the
 * given `mapAssetPath`. Assumes `metadataUrl` is query-less. Idempotent —
 * skips directives already pointing at a debug-metadata container so a
 * later consumer-callback pass can still overwrite via
 * {@link rewriteSourceMappingURL}.
 *
 * @internal Exported for unit testing only.
 */
export function rewriteSourceMappingURLToAbsolute(
  source: string,
  metadataUrl: string,
  mapAssetPath: string,
): string | undefined {
  const match = SOURCE_MAPPING_URL_RE.exec(source)
  if (!match) return undefined
  const isBlockComment = match[2] !== undefined
  const originalUrl = isBlockComment ? match[2] : match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined
  return rewriteSourceMappingURL(
    source,
    `${metadataUrl}?field=source-map&path=${encodeURIComponent(mapAssetPath)}`,
  )
}
