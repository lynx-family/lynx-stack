// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// benchx_cli's MTS runtime does not install this browser-compatible global,
// and older runners do not expose lynx.queueMicrotask either. Motion reads the
// global while evaluating its shared runtime modules.
globalThis.queueMicrotask ??= typeof lynx.queueMicrotask === 'function'
  ? callback => lynx.queueMicrotask(callback)
  : callback => setTimeout(callback, 0);
