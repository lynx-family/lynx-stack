// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isPlainRecord } from './protocol.js';
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
  const generated = perf?._generatePipelineOptions?.();
  if (!isPlainRecord(generated)) return undefined;
  const pipeline = generated as PipelineOptions;
  const id = pipeline.pipelineID;
  if (typeof id !== 'string' || id.length === 0) return undefined;

  if (options?.needTimestamps !== undefined) {
    pipeline.needTimestamps = options.needTimestamps;
  }
  if (options?.pipelineOrigin !== undefined) {
    pipeline.pipelineOrigin = options.pipelineOrigin;
  }
  if (options?.dsl !== undefined) pipeline.dsl = options.dsl;
  if (options?.stage !== undefined) pipeline.stage = options.stage;
  if (side === 'mts') {
    const origin = pipeline.pipelineOrigin;
    if (typeof origin === 'string' && origin.length > 0) {
      perf?._onPipelineStart?.(id, origin);
    } else {
      perf?._onPipelineStart?.(id);
    }
  } else {
    const versionText = typeof sdkVersion === 'string' && sdkVersion.length > 0
      ? sdkVersion
      : '1.0';
    const [major = 0, minor = 0] = versionText.split('.').map(Number);
    if (major > 3 || (major === 3 && minor > 0)) {
      perf?._onPipelineStart?.(id, pipeline);
    } else {
      perf?._onPipelineStart?.(id);
    }
  }
  const flag = options?.timingFlag;
  if (typeof flag === 'string' && flag.length > 0) {
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
  const id = typeof pipeline === 'string'
    ? pipeline
    : (isPlainRecord(pipeline)
      ? pipeline.pipelineID
      : undefined);
  if (
    typeof id !== 'string'
    || id.length === 0
    || typeof timingKey !== 'string'
    || timingKey.length === 0
  ) {
    return;
  }
  perf?._markTiming?.(id, timingKey);
}
