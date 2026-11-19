// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

/**
 * Runs `fn` with Preact's after-paint scheduler switched to synchronous.
 *
 * Preact 11 defers passive-effect cleanups of unmounted components to that
 * flush. Page destroy is the one path with no later turn to run them in:
 * `callDestroyLifetimeFun` returns and native tears the runtime down, so a
 * deferred cleanup would never run at all.
 */
export function withSyncEffectFlush<T>(fn: () => T): T {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const previousRequestAnimationFrame = options.requestAnimationFrame;
  options.requestAnimationFrame = cb => {
    cb();
  };
  try {
    return fn();
  } finally {
    if (previousRequestAnimationFrame) {
      options.requestAnimationFrame = previousRequestAnimationFrame;
    } else {
      delete options.requestAnimationFrame;
    }
  }
}
