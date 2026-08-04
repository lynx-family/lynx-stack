// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { installMainThreadIslandFirstFrame } from '@lynx-js/react/internal/main-thread-island';

import { initMTSDefines, renderRootMTSFallback } from './runtime.js';

// The main-thread entry of a build whose entry declares a root-level
// `<MainThread>`: the same assembled bundle as `./index.js`, plus the island.
//
// The first frame is deferred to `renderPage` instead of running at module
// scope, because the island component arrives through a *later* entry module
// of this same chunk (the build adds one per island, after this framework
// entry). By the time native calls `renderPage`, every entry module has run.
if (initMTSDefines()) {
  installMainThreadIslandFirstFrame(renderRootMTSFallback);
}
