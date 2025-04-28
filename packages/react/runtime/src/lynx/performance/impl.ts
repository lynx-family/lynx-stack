// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { __globalSnapshotPatch } from '../../lifecycle/patch/snapshotPatch.js';

let globalPipelineOptions: PipelineOptions | undefined;

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

function markTimingImpl(
  PerformanceTimingKeys: any,
  timestampKey: any,
  force?: boolean,
): void {
  if (globalPipelineOptions && (force || globalPipelineOptions.needTimestamps)) {
    lynx.performance?._markTiming?.(
      globalPipelineOptions.pipelineID,
      PerformanceTimingKeys[timestampKey],
    );
  }
}

/**
 * @internal
 */
export { globalPipelineOptions, beginPipeline, setPipeline, markTimingImpl };
