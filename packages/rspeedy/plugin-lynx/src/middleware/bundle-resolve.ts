// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RequestHandler,
  RsbuildDevServer,
  RsbuildPluginAPI,
} from '@rsbuild/core'

import { getLynxConfig } from '../config.js'
import {
  hasHashPlaceholder,
  hashPlaceholderToRegExp,
  stripHashPlaceholders,
  templateToRequestRegExp,
} from '../utils/hash-placeholder.js'

interface BundlePattern {
  environment: string
  // Matches the requested pathnames: the printed URL with the placeholders
  // stripped, and — kept working for clients that saw an older output — the
  // URL with the placeholder verbatim.
  requestRE: RegExp
  // Matches the emitted asset names, with the placeholder resolved to a hex
  // digest of the configured length.
  assetRE: RegExp
}

/**
 * Serves the URL that `printUrls` (and the QR code plugin) print when
 * `output.filename.bundle` contains hash placeholders.
 *
 * `resolveBundleFilename` only fills `[name]` and `[platform]`: the hash is
 * computed from the encoded template, which does not exist until
 * `LynxTemplatePlugin` encodes it during the build. The URL is therefore
 * printed with the placeholders stripped (e.g. `/main.lynx.bundle`), a path
 * no emitted asset is named after. This middleware rewrites such a request
 * to the name of the actually emitted bundle, so the printed URL and the QR
 * code keep working, and keep pointing at the latest build, even as the hash
 * changes on every recompile.
 */
export function createBundleResolveMiddleware(
  api: RsbuildPluginAPI,
  server: RsbuildDevServer,
): RequestHandler {
  const lynxConfig = getLynxConfig(api)

  const patterns: BundlePattern[] = []
  for (
    const [environmentName, environmentConfig] of Object.entries(
      api.getNormalizedConfig().environments,
    )
  ) {
    for (const entry of Object.keys(environmentConfig.source.entry ?? {})) {
      const template = lynxConfig.resolveBundleFilename({
        entryName: entry,
        platform: environmentName,
      })
      if (!hasHashPlaceholder(template)) {
        continue
      }
      const assetRE = hashPlaceholderToRegExp(template)
      for (
        const requestRE of [
          // The printed URL, with the hash placeholders stripped.
          templateToRequestRegExp(stripHashPlaceholders(template)),
          // The URL with the placeholder verbatim, as printed before the
          // placeholders were stripped.
          templateToRequestRegExp(template),
        ]
      ) {
        patterns.push({ environment: environmentName, requestRE, assetRE })
      }
    }
  }

  if (patterns.length === 0) {
    // No hash placeholder in any bundle filename: nothing to resolve.
    return (_req, _res, next) => next()
  }

  return async (req, _res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next()
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    let pathname = url.pathname
    try {
      // The brackets of a placeholder may arrive percent-encoded
      // (`%5B`/`%5D`), depending on the client.
      pathname = decodeURIComponent(pathname)
    } catch {
      // Malformed escape sequence: keep the raw pathname.
    }

    for (const { environment, requestRE, assetRE } of patterns) {
      const match = requestRE.exec(pathname)
      if (
        !match
        // The filename has to cover the whole tail of the pathname, so routes
        // that merely contain a matching segment are left alone.
        || match.index + match[0].length !== pathname.length
        || (match.index > 0 && !pathname.startsWith('/', match.index - 1))
      ) {
        continue
      }

      const environmentAPI = server.environments[environment]
      let assets: string[] = []
      if (environmentAPI !== undefined) {
        const { compilation } = await environmentAPI.getStats()
        assets = Object.keys(compilation.assets)
      }
      const assetName = assets.find(asset => assetRE.test(asset))
      if (assetName === undefined) {
        // The first compile has not emitted the template yet.
        break
      }

      // Rewriting the URL (instead of serving the file) keeps the headers,
      // the caching and the `dev.writeToDisk: false` behavior of the Rsbuild
      // asset middleware intact. The prefix before the filename (e.g. the
      // `server.base`) is preserved; the base middleware strips it for the
      // asset middleware as usual.
      req.url = `${pathname.slice(0, match.index)}${assetName}${url.search}`
      break
    }
    next()
  }
}
