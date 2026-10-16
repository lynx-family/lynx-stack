// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Old destruction observers can release refs after the next entry is evaluated.
const backgroundIdKey = Symbol.for('__LYNX_BACKGROUND_MAIN_THREAD_REF_ID__');
const mainThreadIdKey = Symbol.for('__LYNX_MAIN_THREAD_MAIN_THREAD_REF_ID__');
const lynxSymbols = lynx as unknown as Record<symbol, number>;

lynxSymbols[backgroundIdKey] ??= 0;
lynxSymbols[mainThreadIdKey] ??= 0;

/** @internal */
export function allocateMainThreadRefId(): number {
  return __JS__ ? ++lynxSymbols[backgroundIdKey]! : --lynxSymbols[mainThreadIdKey]!;
}

/** @internal */
export function clearMainThreadRefIdsForTesting(): void {
  lynxSymbols[backgroundIdKey] = lynxSymbols[mainThreadIdKey] = 0;
}
