// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { onRootContextSwitch } from '../render-context.js';

let reloadVersion = 0;

if (typeof __LYNX_GROUP_MODULE_SHARING__ !== 'undefined' && __LYNX_GROUP_MODULE_SHARING__) {
  onRootContextSwitch(
    (ctx) => ctx.reloadVersion = reloadVersion,
    (ctx) => reloadVersion = ctx.reloadVersion ?? 0,
  );
}

export function getReloadVersion(): number {
  return reloadVersion;
}

export function increaseReloadVersion(): number {
  return ++reloadVersion;
}
