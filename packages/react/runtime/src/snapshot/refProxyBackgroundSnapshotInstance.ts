// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Resolves a user-facing ref (a RefProxy minted by the rendering pipeline)
// to its backing BackgroundSnapshotInstance. Lives outside `delay.ts` so
// that `delay.ts` doesn't have to import `backgroundSnapshot.ts` directly —
// that import closes a cycle via `backgroundSnapshot.ts → snapshot/ref.ts
// → delay.ts (RefProxy)`. This module sits downstream of both and composes
// them without being part of the cycle.

import { refProxyRefAttr } from './lifecycle/ref/delay.js';
import type { BackgroundSnapshotInstance } from './snapshot/backgroundSnapshot.js';
import { backgroundSnapshotInstanceManager } from './snapshot/backgroundSnapshot.js';
import { hydrationMap } from './snapshot/snapshotInstanceHydrationMap.js';

/**
 * Same shape as the old `refProxyToBackgroundSnapshotInstance` WeakMap so
 * callers can keep their `.get(ref)?.()` idiom: given a ref, returns a
 * resolver thunk that looks up the current
 * {@link BackgroundSnapshotInstance}, or `undefined` if the ref was not
 * minted by this pipeline (e.g. refs from `lynx.createSelectorQuery()` or
 * third-party sources).
 */
export const refProxyToBackgroundSnapshotInstance: {
  get(ref: object): (() => BackgroundSnapshotInstance) | undefined;
} = {
  get(ref) {
    const refAttr = refProxyRefAttr.get(ref);
    if (!refAttr) return undefined;
    return () => {
      // Re-apply `hydrationMap` on every call so post-hydration id remaps
      // are picked up transparently.
      const realRefId = hydrationMap.get(refAttr[0]) ?? refAttr[0];
      return backgroundSnapshotInstanceManager.values.get(realRefId)!;
    };
  },
};
