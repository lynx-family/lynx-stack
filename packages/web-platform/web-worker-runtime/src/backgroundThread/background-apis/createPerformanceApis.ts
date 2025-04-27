// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeApp } from '@lynx-js/web-constants';
import type { TimingSystem } from './createTimingSystem.js';

export function createPerformanceApis(timingSystem: TimingSystem): Pick<
  NativeApp,
  | 'generatePipelineOptions'
  | 'onPipelineStart'
  | 'markPipelineTiming'
  | 'bindPipelineIdWithTimingFlag'
  | 'profileStart'
  | 'profileEnd'
> {
  let inc = 0;
  const performanceApis = {
    generatePipelineOptions: () => {
      const newPipelineId = `_pipeline_` + (inc++);
      return {
        pipelineID: newPipelineId,
        needTimestamps: false,
      };
    },
    onPipelineStart: function(): void {
      // Do nothing
    },
    markPipelineTiming: function(
      pipelineId: string,
      timingKey: string,
    ): void {
      timingSystem.markTimingInternal(timingKey, pipelineId);
    },
    bindPipelineIdWithTimingFlag: function(
      pipelineId: string,
      timingFlag: string,
    ): void {
      if (!timingSystem.pipelineIdToTimingFlags.has(pipelineId)) {
        timingSystem.pipelineIdToTimingFlags.set(pipelineId, []);
      }
      const timingFlags = timingSystem.pipelineIdToTimingFlags.get(pipelineId)!;
      timingFlags.push(timingFlag);
    },
    profileStart: () => {
      console.error('NYI: profileStart. This is an issue of lynx-core.');
    },
    profileEnd: () => {
      console.error('NYI: profileEnd. This is an issue of lynx-core.');
    },
  };
  return performanceApis;
}
