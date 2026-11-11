// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const lynxQueueMicrotask: typeof lynx.queueMicrotask = /* @__PURE__ */ (() => {
  if (lynx.queueMicrotask) {
    return (fn) => lynx.queueMicrotask(fn);
  } else if (typeof globalThis.Promise === 'function') {
    const resolved = globalThis.Promise.resolve();
    /* v8 ignore start */
    return (fn) => {
      // Schedule as a microtask, and surface exceptions like queueMicrotask would.
      resolved.then(fn).catch((err) => {
        setTimeout(() => {
          throw err;
        }, 0);
      });
    };
  } else {
    // Fallback to macrotask when microtasks aren't available.
    return (fn) => {
      setTimeout(fn, 0);
    };
  }
  /* v8 ignore stop */
})();
