// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Webpack module layers used to separate the dual-thread bundles. */
export const LAYERS = {
  BACKGROUND: 'vue:background',
  MAIN_THREAD: 'vue:main-thread',
} as const
