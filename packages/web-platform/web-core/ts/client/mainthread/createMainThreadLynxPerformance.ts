// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxPerformance } from '../../types/index.js';

type ProfileTraceOption = unknown;

interface ProfileTimingContext {
  traceName: string;
  startMarkName: string;
  option?: ProfileTraceOption;
}

type MarkTiming = (
  timingKey: string,
  pipelineId?: string,
  timeStamp?: number,
) => void;

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

export function createMainThreadLynxPerformance(
  markTiming: MarkTiming,
): LynxPerformance {
  let pipelineIdInc = 0;
  let profileFlowIdInc = 0;
  let profileMarkInc = 0;
  const profileTimingStack: ProfileTimingContext[] = [];
  return {
    _generatePipelineOptions: () => {
      return {
        pipelineID: `_pipeline_mts_` + (pipelineIdInc++),
        needTimestamps: false,
      };
    },
    _onPipelineStart: () => {
      // Do nothing.
    },
    _bindPipelineIdWithTimingFlag: () => {
      // Timing flags are posted by the element flush path on the web main thread.
    },
    _markTiming: (
      pipelineId: string,
      timingKey: string,
    ): void => {
      markTiming(timingKey, pipelineId);
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
}
