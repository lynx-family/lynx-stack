// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Worklet } from '../worklet-runtime/bindings/types.js';

export function isMainThreadFunction(value: unknown): value is Worklet {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as { _wkltId?: unknown })._wkltId === 'string';
}
