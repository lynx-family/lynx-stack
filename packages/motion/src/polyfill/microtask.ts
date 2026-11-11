// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Schedule without installing a global or calling a host method unbound. */
export function queueMicrotask(callback: () => void): void {
  if (typeof lynx !== 'undefined' && lynx.queueMicrotask) {
    lynx.queueMicrotask(callback);
  } else if (globalThis.queueMicrotask) {
    globalThis.queueMicrotask(callback);
  } else {
    void Promise.resolve().then(callback).catch((error: unknown) => {
      setTimeout(() => {
        throw error;
      }, 0);
    });
  }
}
