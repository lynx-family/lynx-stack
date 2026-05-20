// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { applyInitDataUpdateFromNative } from '../../core/lynx-update-data.js';
import type { NativeUpdateDataOptions } from '../../core/lynx-update-data.js';

interface LynxGlobalEventEmitter {
  emit: (eventName: string, args?: unknown[]) => void;
}

export function updateCardData(
  newData: Record<string, unknown>,
  options?: NativeUpdateDataOptions,
): void {
  const restNewData = applyInitDataUpdateFromNative(newData, options);
  (lynx.getJSModule('GlobalEventEmitter') as LynxGlobalEventEmitter).emit('onDataChanged', [restNewData]);
}
