import 'background-only';
import { options, type VNode } from 'preact';
import { __globalSnapshotPatch } from '../../lifecycle/patch/snapshotPatch.js';
import { DIFF } from '../../renderToOpcodes/constants.js';
import { beginPipeline, globalPipelineOptions } from './impl.js';
import { markTimingImpl } from './impl.js';

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

function markBackgroundThreadTiming(
  timestampKey: BackgroundThreadPerformanceTimingKeys,
  force?: boolean,
): void {
  return markTimingImpl(
    BackgroundThreadPerformanceTimingKeys,
    timestampKey,
    force,
  );
}

/**
 * @deprecated used by old timing api(setState timing flag)
 */
const PerfSpecificKey = '__lynx_timing_flag';
let timingFlag: string | undefined;
let shouldMarkDiffVdomStart = false;
let shouldMarkDiffVdomEnd = false;

/**
 * @deprecated used by old timing api(setState timing flag)
 */
function markBackgroundThreadTimingLegacy(key: BackgroundThreadPerformanceTimingKeys, timingFlag_?: string): void {
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

function initTimingAPI(): void {
  const oldDiff = options[DIFF];
  options[DIFF] = (vnode: VNode) => {
    // check `__globalSnapshotPatch` to make sure this only runs after hydrate
    if (__JS__ && __globalSnapshotPatch) {
      if (!globalPipelineOptions) {
        beginPipeline(false);
        markBackgroundThreadTiming(BackgroundThreadPerformanceTimingKeys.diff_vdom_start, true);
      }
      if (shouldMarkDiffVdomStart) {
        markBackgroundThreadTimingLegacy(BackgroundThreadPerformanceTimingKeys.update_diff_vdom_start);
      }
    }
    oldDiff?.(vnode);
  };
}

/**
 * @internal
 */
export {
  BackgroundThreadPerformanceTimingKeys,
  markBackgroundThreadTiming,
  markBackgroundThreadTimingLegacy,
  initTimingAPI,
  PerfSpecificKey,
};
/**
 * @internal
 */
export { globalPipelineOptions, beginPipeline, setPipeline } from './impl.js';
