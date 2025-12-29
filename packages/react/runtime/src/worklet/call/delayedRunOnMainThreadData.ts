// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RunWorkletCtxData } from '@lynx-js/react/worklet-runtime/bindings';

export let delayedRunOnMainThreadData: RunWorkletCtxData[] = [];

export function takeDelayedRunOnMainThreadData(): typeof delayedRunOnMainThreadData {
  const data = delayedRunOnMainThreadData;
  delayedRunOnMainThreadData = [];
  return data;
}
