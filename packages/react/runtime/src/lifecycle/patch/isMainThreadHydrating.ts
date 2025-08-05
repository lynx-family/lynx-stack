// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onHydrationFinished } from '@lynx-js/react/worklet-runtime/bindings';

export let isMainThreadHydrating = false;

export function setMainThreadHydrating(isHydrating: boolean): void {
  if (!isHydrating && isMainThreadHydrating) {
    onHydrationFinished();
  }
  isMainThreadHydrating = isHydrating;
}
