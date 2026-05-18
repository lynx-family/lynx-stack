// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
 * Rewrite a JS file's trailing `//# sourceMappingURL=…` comment to
 * point at the unified `debug-metadata.json` endpoint at
 * `metadataUrl`. Returns the new source, or `undefined` when there's
 * no trailer / the trailer is a `data:` URL / it already points at
 * `debug-metadata.json` (idempotent).
 *
 * The new URL is `${metadataUrl}?field=source-map&path=${encoded mapAssetPath}`.
 * `mapAssetPath` is the bundler-relative path of the `.map` asset
 * (i.e. `${jsAssetName}.map`), used as the `path=` selector so the
 * resolver disambiguates same-basename assets across entries.
 *
 * Caller is responsible for computing `metadataUrl` — typically
 * `args.encodeData.sourceContent.config.debugMetadataUrl`, which
 * `LynxTemplatePlugin` populates with `joinPublicPath(publicPath,
 * <intermediate>/debug-metadata.json)`.
 *
 * @internal Exported for unit testing only.
 */
export function rewriteTrailerToAbsoluteUrl(
  source: string,
  metadataUrl: string,
  mapAssetPath: string,
): string | undefined {
  const match = SOURCE_MAPPING_URL_TRAILER.exec(source)
  if (!match) return undefined
  const originalUrl = match[1]
  if (!originalUrl || originalUrl.startsWith('data:')) return undefined
  if (originalUrl.includes(DEBUG_METADATA_ASSET_NAME)) return undefined
  const newUrl = `${metadataUrl}?field=source-map&path=${
    encodeURIComponent(mapAssetPath)
  }`
  return source.slice(0, match.index) + `//# sourceMappingURL=${newUrl}`
}
