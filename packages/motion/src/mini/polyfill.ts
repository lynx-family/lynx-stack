// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
function shimQueueMicroTask() {
  if (
    !globalThis.queueMicrotask
    || (typeof lynx !== 'undefined'
      && globalThis.queueMicrotask === lynx.queueMicrotask)
  ) {
    // Guard against undefined lynx global before accessing lynx.queueMicrotask
    if (typeof lynx !== 'undefined' && lynx.queueMicrotask) {
      // The native scheduler needs its Lynx receiver, even when called detached.
      globalThis.queueMicrotask = (callback) => lynx.queueMicrotask(callback);
    } else {
      const resolved = globalThis.Promise.resolve();
      globalThis.queueMicrotask = (fn) => {
        // Schedule as a microtask, and surface exceptions like queueMicrotask would.
        resolved.then(fn).catch((err) => {
          setTimeout(() => {
            throw err;
          }, 0);
        });
      };
    }
  }
}

shimQueueMicroTask();
