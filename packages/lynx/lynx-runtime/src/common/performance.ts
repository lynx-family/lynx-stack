// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  CreatePipelineOptions,
  CreatedPipelineOptions,
  HostPerformanceObject,
  PipelineOptions,
} from './types.js';

export function createHostPipeline(
  perf: HostPerformanceObject | undefined,
  options: CreatePipelineOptions | undefined,
  side: 'mts' | 'bts',
  sdkVersion?: string,
): CreatedPipelineOptions | undefined {
  const pipeline = perf?._generatePipelineOptions?.();
  const id = pipeline?.pipelineID;
  if (!pipeline || !id) return undefined;

  if (options?.needTimestamps !== undefined) {
    pipeline.needTimestamps = options.needTimestamps;
  }
  if (options?.pipelineOrigin !== undefined) {
    pipeline.pipelineOrigin = options.pipelineOrigin;
  }
  if (options?.dsl !== undefined) pipeline.dsl = options.dsl;
  if (options?.stage !== undefined) pipeline.stage = options.stage;
  if (side === 'mts') {
    if (pipeline.pipelineOrigin) {
      perf?._onPipelineStart?.(id, pipeline.pipelineOrigin);
    } else {
      perf?._onPipelineStart?.(id);
    }
  } else {
    const [major = 0, minor = 0] = (sdkVersion ?? '1.0').split('.').map(Number);
    if (major > 3 || (major === 3 && minor > 0)) {
      perf?._onPipelineStart?.(id, pipeline);
    } else {
      perf?._onPipelineStart?.(id);
    }
  }
  const flag = options?.timingFlag;
  if (flag) {
    const bind = side === 'mts'
      ? perf?._bindPipelineIDWithTimingFlag
        ?? perf?._bindPipelineIdWithTimingFlag
      : perf?._bindPipelineIdWithTimingFlag
        ?? perf?._bindPipelineIDWithTimingFlag;
    bind?.call(perf, id, flag);
  }
  return pipeline as CreatedPipelineOptions;
}

export function markHostTiming(
  perf: HostPerformanceObject | undefined,
  pipeline: string | PipelineOptions | undefined,
  timingKey: string,
): void {
  const id = typeof pipeline === 'string' ? pipeline : pipeline?.pipelineID;
  if (!id || !timingKey) return;
  perf?._markTiming?.(id, timingKey);
}
