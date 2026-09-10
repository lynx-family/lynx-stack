// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  registerLazyRuntimeBackend,
  sExportsJSXDevRuntime,
  target,
} from './target.js';

registerLazyRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

export const {
  Fragment,
  jsx,
  jsxDEV,
  jsxs,
} = target[sExportsJSXDevRuntime];
