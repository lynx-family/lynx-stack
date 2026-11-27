// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  discardBoundDelayedRunOnBackgroundFunctions,
  flushBoundDelayedRunOnBackgroundFunctions,
  onHydrationFinished,
} from '@lynx-js/react/worklet-runtime/bindings';

export let isMainThreadHydrating = false;

export function setMainThreadHydrating(
  isHydrating: boolean,
  partial?: boolean,
  discardBound?: boolean,
): void {
  const wasHydrating = isMainThreadHydrating;
  isMainThreadHydrating = isHydrating;
  if (!isHydrating && wasHydrating) {
    if (partial) {
      if (discardBound) {
        discardBoundDelayedRunOnBackgroundFunctions();
      } else {
        flushBoundDelayedRunOnBackgroundFunctions();
      }
    } else {
      onHydrationFinished();
    }
  }
}
