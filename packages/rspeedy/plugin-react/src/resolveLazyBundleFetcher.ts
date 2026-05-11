// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const FETCH_BUNDLE_MIN_ENGINE_VERSION = '3.8'

export function resolveLazyBundleFetcher(
  engineVersion: string | undefined,
): 'FetchBundle' | 'QueryComponent' {
  const meets = meetsMinEngineVersion(
    engineVersion,
    FETCH_BUNDLE_MIN_ENGINE_VERSION,
  )
  const envOverride = process.env['REACT_LAZY_BUNDLE_FETCHER']
  if (envOverride === 'FetchBundle' && !meets) {
    throw new Error(
      `[pluginReactLynx] REACT_LAZY_BUNDLE_FETCHER=FetchBundle `
        + `requires targetSdkVersion >= ${FETCH_BUNDLE_MIN_ENGINE_VERSION}, `
        + `but got ${engineVersion ? `'${engineVersion}'` : '<unset>'}. `
        + `Older hosts do not expose 'lynx.fetchBundle' / 'lynx.loadScript'. `
        + `Either bump 'targetSdkVersion' to `
        + `'${FETCH_BUNDLE_MIN_ENGINE_VERSION}' or higher, or unset `
        + `REACT_LAZY_BUNDLE_FETCHER (the default falls back to `
        + `'QueryComponent' on older hosts).`,
    )
  }
  if (envOverride === 'FetchBundle' || envOverride === 'QueryComponent') {
    return envOverride
  }
  return meets ? 'FetchBundle' : 'QueryComponent'
}

function meetsMinEngineVersion(
  actual: string | undefined,
  min: string,
): boolean {
  if (!actual) return false
  const actualParts = actual.split('.').map(Number)
  const minParts = min.split('.').map(Number)
  const len = Math.max(actualParts.length, minParts.length)
  for (let i = 0; i < len; i++) {
    const a = actualParts[i] ?? 0
    const m = minParts[i] ?? 0
    if (Number.isNaN(a) || Number.isNaN(m)) return false
    if (a > m) return true
    if (a < m) return false
  }
  return true
}
