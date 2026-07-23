// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const BUNDLE_STATS_JSON_OPTIONS = {
  assets: true,
  chunks: true,
  modules: true,
  entrypoints: true,
  chunkGroups: true,
  // `reasons` grows with the number of module edges and can push `stats.json`
  // beyond V8's maximum string length on large projects, while bundle-analysis
  // consumers only need module names and sizes.
  reasons: false,
} as const
