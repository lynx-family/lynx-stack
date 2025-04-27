// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  dispatchLynxViewEventEndpoint,
  markTimingEndpoint,
  postTimingFlagsEndpoint,
  type EventEmitter,
  type TimingInfo,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export type TimingSystem = {
  registerGlobalEmitter: (globalEventEmitter: EventEmitter) => void;
  markTimingInternal: (timingKey: string, pipelineId?: string) => void;
  pipelineIdToTimingFlags: Map<string, string[]>;
};

const ListenerKeys = {
  onSetup: 'lynx.performance.timing.onSetup',
  onUpdate: 'lynx.performance.timing.onUpdate',
} as const;

export function createTimingSystem(
  mainThreadRpc: Rpc,
  backgroundThreadRpc: Rpc,
): TimingSystem {
  let isFp = true;
  const setupTiming: Record<string, number> = {};
  const pipelineIdToTiming: Map<string, Record<string, number>> = new Map();
  const pipelineIdToTimingFlags: Map<string, string[]> = new Map();
  const dispatchLynxViewEvent = backgroundThreadRpc.createCall(
    dispatchLynxViewEventEndpoint,
  );
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
  const registerGlobalEmitter = (globalEventEmitter: EventEmitter) => {
    mainThreadRpc.registerHandler(
      postTimingFlagsEndpoint,
      (
        timingFlags: string[],
        pipelineId: string | undefined,
      ) => {
        if (!pipelineId) {
          commonTimingFlags = commonTimingFlags.concat(timingFlags);
        } else timingFlags = timingFlags.concat(commonTimingFlags);
        if (isFp) {
          const timingInfo: TimingInfo = {
            extra_timing: {},
            setup_timing: setupTiming,
            update_timings: {},
            metrics: {},
            has_reload: false,
            thread_strategy: 0,
            url: '',
          };
          globalEventEmitter.emit(ListenerKeys.onSetup, [timingInfo]);
          dispatchLynxViewEvent('timing', setupTiming);
        } else {
          const timings =
            (pipelineId ? pipelineIdToTiming.get(pipelineId) : undefined) ?? {};
          const flags = [
            ...timingFlags,
            ...(pipelineIdToTimingFlags.get(pipelineId!) ?? []),
          ];
          const timingInfo: TimingInfo = {
            extra_timing: {},
            setup_timing: {},
            update_timings: Object.fromEntries(
              [...flags].map(flag => [flag, timings]),
            ),
            metrics: {},
            has_reload: false,
            thread_strategy: 0,
            url: '',
          };
          globalEventEmitter.emit(ListenerKeys.onUpdate, [timingInfo]);
          dispatchLynxViewEvent('timing', timings);
        }
        if (pipelineId) {
          pipelineIdToTimingFlags.delete(pipelineId);
          pipelineIdToTiming.delete(pipelineId);
        }
        if (isFp) {
          isFp = false;
        }
      },
    );
  };
  mainThreadRpc.registerHandler(
    markTimingEndpoint,
    markTimingInternal,
  );
  backgroundThreadRpc.registerHandler(
    markTimingEndpoint,
    markTimingInternal,
  );
  return {
    markTimingInternal,
    registerGlobalEmitter,
    pipelineIdToTimingFlags,
  };
}
