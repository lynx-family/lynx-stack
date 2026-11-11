// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Side-effect entry that registers this bundle's runtime markers (backend,
// version, ...) on load. Imported once by the element-template runtime entry
// so later-loaded lazy bundles register their own markers too.

import { RUNTIME_BACKEND_ELEMENT_TEMPLATE, registerRuntimeBackend } from '../core/lynx/runtime-backend.js';
import { registerRuntimeVersion } from '../core/lynx/runtime-version.js';

registerRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE);
// An older `react-webpack-plugin` may not stamp `__RUNTIME_VERSION__`. Guard
// with `typeof` so referencing it does not throw when the define is missing.
registerRuntimeVersion(
  typeof __RUNTIME_VERSION__ === 'undefined' ? undefined : __RUNTIME_VERSION__,
);
