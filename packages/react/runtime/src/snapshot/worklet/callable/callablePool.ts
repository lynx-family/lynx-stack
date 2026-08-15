// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  MainThreadCallableCtxPatch,
  MainThreadCallableRunPatch,
  Worklet,
} from '@lynx-js/react/worklet-runtime/bindings';

import { isMtsEnabled } from '../functionality.js';

const ctxPatch: Map<number, Worklet | null> = new Map();

const runPatch: Set<number> = new Set();

/**
 * Stage the latest ctx of a `MainThreadEvent` (or `null` to release it) for
 * the next flush to the main thread. The last write per id wins within a flush.
 * A release also cancels a pending run of the same id: a callable released in
 * this commit must not run in it.
 *
 * @internal
 */
export function addCallableCtxPatch(id: number, ctx: Worklet | null): void {
  if (!isMtsEnabled()) {
    return;
  }

  if (ctx === null) {
    runPatch.delete(id);
  }
  ctxPatch.set(id, ctx);
}

/**
 * Schedule a `useMainThreadEffect` ctx to run on the main thread after this
 * commit's patch is applied.
 *
 * @internal
 */
export function addCallableRunPatch(id: number): void {
  if (!isMtsEnabled()) {
    return;
  }

  runPatch.add(id);
}

/**
 * @internal
 */
export function takeCallableRunPatch(): MainThreadCallableRunPatch {
  const res = Array.from(runPatch);
  runPatch.clear();
  return res;
}

/**
 * Take the staged ctx updates. Releases (`null` ctxs) are taken separately by
 * {@link takeCallableReleasePatch} so they can be flushed after the commit's
 * main-thread tasks: a task scheduled in the unmounting commit (e.g. stopping
 * an animation) may still legitimately call the callable.
 *
 * @internal
 */
export function takeCallableCtxUpdatePatch(): MainThreadCallableCtxPatch {
  const res: MainThreadCallableCtxPatch = [];
  for (const [id, ctx] of ctxPatch) {
    if (ctx !== null) {
      res.push([id, ctx]);
      ctxPatch.delete(id);
    }
  }
  return res;
}

/**
 * Take the staged releases, in reverse staging order (LIFO): teardown mirrors
 * destructor semantics, so the teardown of a slot may still use anything
 * declared (and therefore staged) before it — e.g. an effect cleanup may use
 * an instance declared above it, whose dispose then runs after the cleanup.
 *
 * @internal
 */
export function takeCallableReleasePatch(): MainThreadCallableCtxPatch {
  const res: MainThreadCallableCtxPatch = Array.from(ctxPatch).reverse();
  ctxPatch.clear();
  return res;
}
