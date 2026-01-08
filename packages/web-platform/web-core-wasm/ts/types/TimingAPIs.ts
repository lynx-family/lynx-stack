// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface SetupTimingInfo {
  [key: string]: unknown;
}
export interface UpdateTimingInfo {
  [key: string]: unknown;
}
export interface ExtraTimingInfo {
  [key: string]: unknown;
}

export interface MetricsTimingInfo {
}
export interface TimingInfo {
  extra_timing: ExtraTimingInfo;
  setup_timing: SetupTimingInfo;
  update_timings: {
    [key: string]: UpdateTimingInfo;
  };
  metrics: MetricsTimingInfo;
  has_reload: boolean;
  thread_strategy: number;
  url: string;
  [key: string]: unknown;
}

export interface PerformancePipelineOptions {
  pipelineID: string;
  needTimestamps: boolean;
}

export interface TimingEntry {
  timingKey: string;
  pipelineId?: string;
  timeStamp: number;
}
