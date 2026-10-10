// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const reloadVersionKey = Symbol.for('__LYNX_RELOAD_VERSION__');
const lynxSymbols = lynx as unknown as Record<symbol, number>;

lynxSymbols[reloadVersionKey] ??= 0;

export function getReloadVersion(): number {
  return lynxSymbols[reloadVersionKey]!;
}

export function increaseReloadVersion(): number {
  return ++lynxSymbols[reloadVersionKey]!;
}
