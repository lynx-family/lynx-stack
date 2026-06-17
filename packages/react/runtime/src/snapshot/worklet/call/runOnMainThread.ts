// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRunOnMainThread } from '../../../core/thread-function-call/main-thread.js';
import type { RunOnMainThread } from '../../../core/thread-function-call/main-thread.js';
import { isRendering } from '../../lifecycle/isRendering.js';
import { __globalSnapshotPatch } from '../../lifecycle/patch/snapshotPatch.js';

/**
 * `runOnMainThread` allows triggering main thread functions on the main thread asynchronously.
 * @param fn - The main thread functions to be called.
 * @returns A function. Calling which with the arguments to be passed to the main thread function to trigger it on the main thread. This function returns a promise that resolves to the return value of the main thread function.
 * @example
 * ```ts
 * import { runOnMainThread } from '@lynx-js/react';
 *
 * async function someFunction() {
 *   const fn = runOnMainThread(() => {
 *     'main thread';
 *     return 'hello';
 *   });
 *   const result = await fn();
 * }
 * ```
 * @public
 */
export const runOnMainThread: RunOnMainThread = createRunOnMainThread({
  shouldDispatchRunOnMainThreadDirectly() {
    return __globalSnapshotPatch !== undefined && !isRendering.value;
  },
});
