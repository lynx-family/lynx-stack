// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  dispatchMarkTiming,
  flushMarkTiming,
  markTimingEndpoint,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function createMarkTimingInternal(
  backgroundThreadRpc: Rpc,
) {
  const markTiming = backgroundThreadRpc.createCall(markTimingEndpoint);
  const cacheMarkTimings = {
    records: [],
    timeout: null,
  };

  return {
    markTimingInternal: (
      timingKey: string,
      pipelineId?: string,
      timeStamp?: number,
    ) => {
      dispatchMarkTiming({
        timingKey,
        pipelineId,
        timeStamp,
        markTiming,
        cacheMarkTimings,
      });
    },
    flushMarkTimingInternal: () =>
      flushMarkTiming(markTiming, cacheMarkTimings),
  };
}
