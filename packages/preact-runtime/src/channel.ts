// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The background-thread side of the op channel: batches ops per microtask and
 * sends them to the fixed main-thread runtime through `callLepusMethod`.
 */

import { PATCH_METHOD } from './ops.js';
import type { Op } from './ops.js';

declare const lynx: {
  getNativeApp(): {
    callLepusMethod(
      name: string,
      data: unknown,
      callback?: (ret: unknown) => void,
    ): void;
  };
};

// PrimJS has no `queueMicrotask`; fall back to the promise job queue.
const scheduleMicrotask: (cb: () => void) => void =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (cb) => void Promise.resolve().then(cb);

const queue: Op[] = [];
let scheduled = false;

/** Callbacks run right before a batch is sent (style/dataset serialization). */
const preFlushCallbacks = new Set<() => void>();

export function enqueueOp(op: Op): void {
  queue.push(op);
  scheduleFlush();
}

export function beforeFlush(cb: () => void): void {
  preFlushCallbacks.add(cb);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;
  scheduleMicrotask(flush);
}

export function flush(): void {
  scheduled = false;
  for (const cb of preFlushCallbacks) {
    cb();
  }
  preFlushCallbacks.clear();
  if (queue.length === 0) {
    return;
  }
  const ops = queue.splice(0, queue.length);
  lynx.getNativeApp().callLepusMethod(PATCH_METHOD, {
    data: JSON.stringify(ops),
  });
}
