// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MarkTiming } from '../types/MarkTiming.js';

export const dispatchMarkTiming = (
  { timingKey, pipelineId, timeStamp, markTiming, cacheMarkTimings }: {
    timingKey: string;
    pipelineId?: string;
    timeStamp?: number;
    markTiming: (markTimings: MarkTiming[]) => void;
    cacheMarkTimings: { records: MarkTiming[]; timeout: NodeJS.Timeout | null };
  },
) => {
  cacheMarkTimings.records.push({
    timingKey,
    pipelineId,
    timeStamp: timeStamp ?? performance.now() + performance.timeOrigin,
  });

  if (!cacheMarkTimings.timeout) {
    cacheMarkTimings.timeout = setTimeout(() => {
      markTiming(cacheMarkTimings.records);
      cacheMarkTimings.records = [];
      cacheMarkTimings.timeout = null;
    }, 500);
  }
};

export const flushMarkTiming = (
  markTiming: (markTimings: MarkTiming[]) => void,
  cacheMarkTimings: { records: MarkTiming[]; timeout: NodeJS.Timeout | null },
) => {
  markTiming(cacheMarkTimings.records);
  cacheMarkTimings.records = [];
  if (cacheMarkTimings.timeout) {
    clearTimeout(cacheMarkTimings.timeout);
    cacheMarkTimings.timeout = null;
  }
};
