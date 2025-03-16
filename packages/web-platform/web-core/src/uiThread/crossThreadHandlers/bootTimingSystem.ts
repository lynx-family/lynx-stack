// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  postTimingInfoFromBackgroundThread,
  postTimingInfoFromMainThread,
  postTimingResult,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function bootTimingSystem(
  mainThreadRpc: Rpc,
  backgroundThreadRpc: Rpc,
  rootDom: HTMLElement,
) {
  const setupTiming: Record<string, number> = {};
  const pipelineIdToTiming: Map<string, Record<string, number>> = new Map();
  let commonTimingFlags: string[] = [];
  function markTimingInternal(
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) {
    if (!timeStamp) timeStamp = performance.now() + performance.timeOrigin;
    if (!pipelineId) {
      setupTiming[timingKey] = timeStamp;
      return;
    }
    if (!pipelineIdToTiming.has(pipelineId)) {
      pipelineIdToTiming.set(pipelineId, {});
    }
    const timingInfo = pipelineIdToTiming.get(pipelineId)!;
    timingInfo[timingKey] = timeStamp;
  }
  function sendTimingResult(
    pipelineId: string | undefined,
    timingFlags: string[],
    isFp: boolean,
  ) {
    const timingInfo =
      (pipelineId ? pipelineIdToTiming.get(pipelineId) : undefined) ?? {};
    if (!pipelineId) commonTimingFlags = commonTimingFlags.concat(timingFlags);
    else timingFlags = timingFlags.concat(commonTimingFlags);
    backgroundThreadRpc.invoke(postTimingResult, [
      pipelineId,
      timingInfo,
      timingFlags,
      isFp ? setupTiming : undefined,
    ]);
    rootDom.dispatchEvent(
      new CustomEvent('timing', {
        detail: isFp ? setupTiming : timingInfo,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    if (pipelineId) {
      pipelineIdToTiming.delete(pipelineId);
    }
  }
  mainThreadRpc.registerHandler(
    postTimingInfoFromMainThread,
    markTimingInternal,
  );
  backgroundThreadRpc.registerHandler(
    postTimingInfoFromBackgroundThread,
    markTimingInternal,
  );
  return {
    markTimingInternal,
    sendTimingResult,
  };
}
