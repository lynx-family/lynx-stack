// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { DIFF } from '../renderToOpcodes/constants.js';
import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import { isSdkVersionGt } from '../utils.js';

enum PerformanceTimingKeys {
  updateSetStateTrigger,
  updateDiffVdomStart,
  updateDiffVdomEnd,
  // updateSetStateTrigger, updateDiffVdomStart and updateDiffVdomEnd is deprecated
  diffVdomStart,
  diffVdomEnd,
  packChangesStart,
  packChangesEnd,
  parseChangesStart,
  parseChangesEnd,
  patchChangesStart,
  patchChangesEnd,
  hydrateParseSnapshotStart,
  hydrateParseSnapshotEnd,
  mtsRenderStart,
  mtsRenderEnd,
}

const PerformanceTimingFlags = {
  reactLynxHydrate: 'react_lynx_hydrate',
} as const;

const PipelineOrigins = {
  reactLynxHydrate: 'reactLynxHydrate',
  updateTriggeredByBts: 'updateTriggeredByBts',
} as const;

type PipelineOrigin = typeof PipelineOrigins[keyof typeof PipelineOrigins];

/**
 * @deprecated used by old timing api(setState timing flag)
 */
const PerfSpecificKey = '__lynx_timing_flag';
let timingFlag: string | undefined;
let shouldMarkDiffVdomStart = false;
let shouldMarkDiffVdomEnd = false;

let globalPipelineOptions: PipelineOptions | undefined;

/**
 * @deprecated used by old timing api(setState timing flag)
 */
function markTimingLegacy(key: PerformanceTimingKeys, timingFlag_?: string): void {
  switch (key) {
    case PerformanceTimingKeys.updateSetStateTrigger: {
      shouldMarkDiffVdomStart = true;
      shouldMarkDiffVdomEnd = true;
      timingFlag = timingFlag_;
      break;
    }
    case PerformanceTimingKeys.updateDiffVdomStart: {
      /* v8 ignore start */
      if (!shouldMarkDiffVdomStart) {
        return;
      }
      /* v8 ignore stop */
      shouldMarkDiffVdomStart = false;
      break;
    }
    case PerformanceTimingKeys.updateDiffVdomEnd: {
      if (!shouldMarkDiffVdomEnd) {
        return;
      }
      shouldMarkDiffVdomEnd = false;
      break;
    }
  }
  lynx.getNativeApp().markTiming?.(timingFlag!, PerformanceTimingKeys[key]);
}

function beginPipeline(needTimestamps: boolean, pipelineOrigin: PipelineOrigin, timingFlag?: string): void {
  globalPipelineOptions = lynx.performance?._generatePipelineOptions?.();
  if (globalPipelineOptions) {
    globalPipelineOptions.needTimestamps = needTimestamps;
    globalPipelineOptions.pipelineOrigin = pipelineOrigin;
    globalPipelineOptions.dsl = 'reactLynx';
    switch (pipelineOrigin) {
      case PipelineOrigins.reactLynxHydrate:
        globalPipelineOptions.stage = 'hydrate';
        break;
      case PipelineOrigins.updateTriggeredByBts:
        globalPipelineOptions.stage = 'update';
        break;
    }

    if (isSdkVersionGt(3, 0)) {
      lynx.performance?._onPipelineStart?.(globalPipelineOptions.pipelineID, globalPipelineOptions);
    } else {
      lynx.performance?._onPipelineStart?.(globalPipelineOptions.pipelineID);
    }
    if (timingFlag) {
      lynx.performance?._bindPipelineIdWithTimingFlag?.(globalPipelineOptions.pipelineID, timingFlag);
    }
  }
}

function setPipeline(pipeline: PipelineOptions | undefined): void {
  globalPipelineOptions = pipeline;
}

function markTiming(timestampKey: PerformanceTimingKeys, force?: boolean): void {
  if (globalPipelineOptions && (force || globalPipelineOptions.needTimestamps)) {
    lynx.performance?._markTiming?.(globalPipelineOptions.pipelineID, PerformanceTimingKeys[timestampKey]);
  }
}

function initTimingAPI(): void {
  const oldDiff = options[DIFF];
  options[DIFF] = (vnode: VNode) => {
    // check `__globalSnapshotPatch` to make sure this only runs after hydrate
    if (__JS__ && __globalSnapshotPatch) {
      if (!globalPipelineOptions) {
        beginPipeline(false, PipelineOrigins.updateTriggeredByBts);
        markTiming(PerformanceTimingKeys.diffVdomStart, true);
      }
      if (shouldMarkDiffVdomStart) {
        markTimingLegacy(PerformanceTimingKeys.updateDiffVdomStart);
      }
    }
    oldDiff?.(vnode);
  };
}

/**
 * @internal
 */
export {
  PerformanceTimingKeys,
  PerformanceTimingFlags,
  PipelineOrigins,
  PerfSpecificKey,
  markTimingLegacy,
  initTimingAPI,
  beginPipeline,
  markTiming,
  setPipeline,
  globalPipelineOptions,
};
