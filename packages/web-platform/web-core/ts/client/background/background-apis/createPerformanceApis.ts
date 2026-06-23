// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { NativeApp } from '../../../types/index.js';
import type { TimingSystem } from './createTimingSystem.js';

type ProfileTraceOption = unknown;

interface ProfileTimingContext {
  traceName: string;
  startMarkName: string;
  option?: ProfileTraceOption;
}

function getUserTimingPerformance(): Performance | undefined {
  const browserPerformance = globalThis.performance;
  if (
    !browserPerformance
    || typeof browserPerformance.mark !== 'function'
    || typeof browserPerformance.measure !== 'function'
  ) {
    return undefined;
  }
  return browserPerformance;
}

function markUserTiming(
  markName: string,
  option?: ProfileTraceOption,
): boolean {
  const browserPerformance = getUserTimingPerformance();
  if (!browserPerformance) {
    return false;
  }
  try {
    if (option === undefined) {
      browserPerformance.mark(markName);
    } else {
      try {
        browserPerformance.mark(markName, { detail: option });
      } catch {
        browserPerformance.mark(markName);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function measureUserTiming(
  traceName: string,
  startMarkName: string,
  endMarkName: string,
  option?: ProfileTraceOption,
): void {
  const browserPerformance = getUserTimingPerformance();
  if (!browserPerformance) {
    return;
  }
  if (option === undefined) {
    try {
      browserPerformance.measure(traceName, startMarkName, endMarkName);
    } catch {
      // Do nothing.
    }
  } else {
    try {
      browserPerformance.measure(traceName, {
        start: startMarkName,
        end: endMarkName,
        detail: option,
      });
    } catch {
      try {
        browserPerformance.measure(traceName, startMarkName, endMarkName);
      } catch {
        // Do nothing.
      }
    }
  }
}

export function createPerformanceApis(timingSystem: TimingSystem): Pick<
  NativeApp,
  | 'generatePipelineOptions'
  | 'onPipelineStart'
  | 'markPipelineTiming'
  | 'bindPipelineIdWithTimingFlag'
  | 'profileStart'
  | 'profileEnd'
  | 'profileMark'
  | 'profileFlowId'
  | 'isProfileRecording'
> {
  let inc = 0;
  let profileFlowIdInc = 0;
  let profileMarkInc = 0;
  const profileTimingStack: ProfileTimingContext[] = [];
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
    profileStart: (
      traceName: string,
      option?: ProfileTraceOption,
    ): void => {
      const id = profileMarkInc++;
      const startMarkName = `lynx.profile:${id}:start:${traceName}`;
      if (markUserTiming(startMarkName, option)) {
        profileTimingStack.push({ traceName, startMarkName, option });
      }
    },
    profileEnd: (): void => {
      const profileTimingContext = profileTimingStack.pop();
      if (!profileTimingContext) {
        return;
      }

      const id = profileMarkInc++;
      const endMarkName =
        `lynx.profile:${id}:end:${profileTimingContext.traceName}`;
      if (!markUserTiming(endMarkName, profileTimingContext.option)) {
        getUserTimingPerformance()?.clearMarks?.(
          profileTimingContext.startMarkName,
        );
        return;
      }
      measureUserTiming(
        profileTimingContext.traceName,
        profileTimingContext.startMarkName,
        endMarkName,
        profileTimingContext.option,
      );

      const browserPerformance = getUserTimingPerformance();
      browserPerformance?.clearMarks?.(profileTimingContext.startMarkName);
      browserPerformance?.clearMarks?.(endMarkName);
    },
    profileMark: (
      traceName: string,
      option?: ProfileTraceOption,
    ): void => {
      markUserTiming(traceName, option);
    },
    profileFlowId: (): number => {
      return ++profileFlowIdInc;
    },
    isProfileRecording: (): boolean => {
      return getUserTimingPerformance() !== undefined;
    },
  };
  return performanceApis;
}
