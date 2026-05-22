// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { DEBUG_METADATA_ASSET_NAME } from './constants.js'

const SOURCE_MAPPING_URL_TRAILER =
  /(?:\/\/[#@]\s*sourceMappingURL=(\S+)|\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\/)\s*$/

/**
 * @internal Exported for unit testing only.
 */
export function rewriteTrailerToAbsoluteUrl(
  source: string,
  metadataUrl: string,
  mapAssetPath: string,
): string | undefined {
  const match = SOURCE_MAPPING_URL_TRAILER.exec(source)
  if (!match) return undefined
  const isBlockComment = match[2] !== undefined
  const originalUrl = isBlockComment ? match[2] : match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined
  const newUrl = `${metadataUrl}?field=source-map&path=${
    encodeURIComponent(mapAssetPath)
  }`
  const trailer = isBlockComment
    ? `/*# sourceMappingURL=${newUrl}*/`
    : `//# sourceMappingURL=${newUrl}`
  return source.slice(0, match.index) + trailer
}
