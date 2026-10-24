// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { cardLifetime } from './card-lifetime.js';

const state = /*#__PURE__*/ cardLifetime('reloadVersion', () => ({ value: 0 }));

export function getReloadVersion(): number {
  return state.value;
}

export function increaseReloadVersion(): number {
  return ++state.value;
}
