// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MainThreadCallableCtxPatch, Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { isMtsEnabled } from '../functionality.js';

const ctxPatch: Map<number, Worklet | null> = new Map();

/**
 * Stage the latest ctx of a `MainThreadCallable` (or `null` to release it) for
 * the next flush to the main thread. The last write per id wins within a flush.
 *
 * @internal
 */
export function addCallableCtxPatch(id: number, ctx: Worklet | null): void {
  if (!isMtsEnabled()) {
    return;
  }

  ctxPatch.set(id, ctx);
}

/**
 * @internal
 */
export function takeCallableCtxPatch(): MainThreadCallableCtxPatch {
  const res: MainThreadCallableCtxPatch = Array.from(ctxPatch);
  ctxPatch.clear();
  return res;
}
