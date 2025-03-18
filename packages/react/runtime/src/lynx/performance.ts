// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { DIFF } from '../renderToOpcodes/constants.js';
import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

enum MainThreadPerformanceTimingKeys {
  update_diff_vdom_start,
  update_diff_vdom_end,
  parse_changes_start,
  parse_changes_end,
  patch_changes_start,
  patch_changes_end,
}

enum BackgroundThreadPerformanceTimingKeys {
  update_diff_vdom_start,
  update_diff_vdom_end,
  update_set_state_trigger,
  // update_set_state_trigger, update_diff_vdom_start and update_diff_vdom_end is deprecated
  diff_vdom_start,
  diff_vdom_end,
  pack_changes_start,
  pack_changes_end,
  hydrate_parse_snapshot_start,
  hydrate_parse_snapshot_end,
}

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
function markTimingLegacy(key: BackgroundThreadPerformanceTimingKeys, timingFlag_?: string): void {
  switch (key) {
    case BackgroundThreadPerformanceTimingKeys.update_set_state_trigger: {
      shouldMarkDiffVdomStart = true;
      shouldMarkDiffVdomEnd = true;
      timingFlag = timingFlag_;
      break;
    }
    case BackgroundThreadPerformanceTimingKeys.update_diff_vdom_start: {
      /* v8 ignore start */
      if (!shouldMarkDiffVdomStart) {
        return;
      }
      /* v8 ignore stop */
      shouldMarkDiffVdomStart = false;
      break;
    }
    case BackgroundThreadPerformanceTimingKeys.update_diff_vdom_end: {
      if (!shouldMarkDiffVdomEnd) {
        return;
      }
      shouldMarkDiffVdomEnd = false;
      break;
    }
  }
  lynx.getNativeApp().markTiming?.(timingFlag!, BackgroundThreadPerformanceTimingKeys[key]);
}

function beginPipeline(needTimestamps: boolean, timingFlag?: string): void {
  globalPipelineOptions = lynx.performance?._generatePipelineOptions?.();
  if (globalPipelineOptions) {
    globalPipelineOptions.needTimestamps = needTimestamps;
    lynx.performance?._onPipelineStart?.(globalPipelineOptions.pipelineID);
    if (timingFlag) {
      lynx.performance?._bindPipelineIdWithTimingFlag?.(globalPipelineOptions.pipelineID, timingFlag);
    }
  }
}

function setPipeline(pipeline: PipelineOptions | undefined): void {
  globalPipelineOptions = pipeline;
}

function markMainThreadTiming(
  timestampKey: MainThreadPerformanceTimingKeys,
  force?: boolean,
): void {
  if (globalPipelineOptions && (force || globalPipelineOptions.needTimestamps)) {
    lynx.performance?._markTiming?.(globalPipelineOptions.pipelineID, MainThreadPerformanceTimingKeys[timestampKey]);
  }
}
function markTiming(
  timestampKey: BackgroundThreadPerformanceTimingKeys,
  force?: boolean,
): void {
  if (globalPipelineOptions && (force || globalPipelineOptions.needTimestamps)) {
    lynx.performance?._markTiming?.(
      globalPipelineOptions.pipelineID,
      BackgroundThreadPerformanceTimingKeys[timestampKey],
    );
  }
}

function initTimingAPI(): void {
  const oldDiff = options[DIFF];
  options[DIFF] = (vnode: VNode) => {
    // check `__globalSnapshotPatch` to make sure this only runs after hydrate
    if (__JS__ && __globalSnapshotPatch) {
      if (!globalPipelineOptions) {
        beginPipeline(false);
        markTiming(BackgroundThreadPerformanceTimingKeys.diff_vdom_start, true);
      }
      if (shouldMarkDiffVdomStart) {
        markTimingLegacy(BackgroundThreadPerformanceTimingKeys.update_diff_vdom_start);
      }
    }
    oldDiff?.(vnode);
  };
}

/**
 * @internal
 */
export {
  MainThreadPerformanceTimingKeys,
  BackgroundThreadPerformanceTimingKeys,
  PerfSpecificKey,
  markTimingLegacy,
  initTimingAPI,
  beginPipeline,
  markMainThreadTiming,
  markTiming,
  setPipeline,
  globalPipelineOptions,
};
