// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Replaces `@rspack/core/hot/dev-server` in Lynx, where the upstream fallback
 * to `window.location.reload()` does not exist. Aliased in `@lynx-js/rspeedy`.
 */

import { emitter as hotEmitter } from '@rspack/core/hot/emitter.js';

import { startHotDevServer } from './startHotDevServer.js';
import type { HotUpdateCoordinator } from './startHotDevServer.js';

declare const __webpack_require__: {
  lynxHMR?: HotUpdateCoordinator;
};

if (import.meta.webpackHot) {
  startHotDevServer(
    import.meta.webpackHot,
    hotEmitter,
    () => __webpack_hash__,
    __webpack_require__.lynxHMR,
  );
} else {
  throw new Error('[HMR] Hot Module Replacement is disabled.');
}
