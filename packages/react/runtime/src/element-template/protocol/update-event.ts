// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementTemplateLifecycleConstant } from './lifecycle-constant.js';
import type { ElementTemplateUpdateCommitContext } from './types.js';

export interface ElementTemplateUpdatePatchOptions {
  pipelineOptions?: PipelineOptions | undefined;
  reloadVersion?: number | undefined;
  flowIds?: number[] | undefined;
}

export interface ElementTemplateUpdateEventData {
  payload: string;
  patchOptions: ElementTemplateUpdatePatchOptions;
}

export interface ElementTemplateUpdateEvent extends RuntimeProxy.Event {
  data: ElementTemplateUpdateEventData;
}

export function createElementTemplateUpdateEvent(
  payload: ElementTemplateUpdateCommitContext,
): ElementTemplateUpdateEvent {
  const flowIds = payload.ops.length > 0 && payload.flowIds && payload.flowIds.length > 0
    ? payload.flowIds
    : undefined;
  return {
    type: ElementTemplateLifecycleConstant.update,
    data: {
      payload: JSON.stringify(payload),
      patchOptions: {
        pipelineOptions: payload.flushOptions.pipelineOptions,
        reloadVersion: payload.reloadVersion,
        flowIds,
      },
    },
  };
}

export function parseElementTemplateUpdateEventPayload(
  data: unknown,
): ElementTemplateUpdateCommitContext {
  return JSON.parse((data as ElementTemplateUpdateEventData).payload) as ElementTemplateUpdateCommitContext;
}
