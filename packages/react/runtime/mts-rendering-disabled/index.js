// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { initMTSDefines, renderRootMTSFallback } from './runtime.js';

if (initMTSDefines()) {
  // Business code is not compiled for the main thread in this mode, so the
  // root boundary's static fallback is rendered here, through the assembled
  // definitions: link an instance under the root before the native
  // `renderPage` call builds the elements (`ensureElements` walks children).
  renderRootMTSFallback();
}
