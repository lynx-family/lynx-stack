// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as ReactLynx from '../../internal.js';

/**
 * `__initMTSDefines` is emitted into the main-thread chunk by the build
 * plugin's runtime module. It registers the snapshot and worklet definitions
 * that the background thread collected but the main-thread bundle does not
 * define, so a patch referencing them does not fail with `Snapshot not found`.
 */
declare const __initMTSDefines:
  | ((runtime: typeof ReactLynx) => void)
  | undefined;

if (typeof __initMTSDefines !== 'undefined') {
  __initMTSDefines(ReactLynx);
}
