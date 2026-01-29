// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spring as spring_ } from 'motion-dom';

import { registerCallable } from '../../utils/registeredFunction.js';

let springHandle = 'springHandle';

if (__MAIN_THREAD__) {
  springHandle = registerCallable(spring_, 'springHandle');
}

export function spring(
  ...args: Parameters<typeof spring_>
): ReturnType<typeof spring_> {
  'main thread';
  return globalThis.runOnRegistered<typeof spring_>(springHandle)(...args);
}
