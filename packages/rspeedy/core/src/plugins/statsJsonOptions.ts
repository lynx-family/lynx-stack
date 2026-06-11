// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const BUNDLE_STATS_JSON_OPTIONS = {
  assets: true,
  chunks: true,
  modules: true,
  entrypoints: true,
  chunkGroups: true,
} as const

export interface BundleStatsJson {
  name?: string
  assets?: unknown
  chunks?: unknown
  modules?: unknown
  entrypoints?: unknown
  namedChunkGroups?: unknown
  children?: BundleStatsJson[]
}

export function getBundleStatsJson(
  statsJson: BundleStatsJson,
): BundleStatsJson {
  if (!statsJson.children || statsJson.children.length === 0) {
    return withoutEmptyChildren(statsJson)
  }

  const childStatsJson =
    statsJson.children.find(child => isLynxStatsChild(child.name))
      ?? statsJson.children[0]!

  return withoutEmptyChildren(childStatsJson)
}

function isLynxStatsChild(name: string | undefined): boolean {
  return name === 'lynx' || name?.startsWith('lynx-') === true
}

function withoutEmptyChildren(statsJson: BundleStatsJson): BundleStatsJson {
  if (!statsJson.children || statsJson.children.length > 0) {
    return statsJson
  }

  const { children: _children, ...statsJsonWithoutEmptyChildren } = statsJson
  return statsJsonWithoutEmptyChildren
}
