// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalCommitContext } from './commit-context.js';
import { getReloadVersion } from '../../core/reload-version.js';
import { dropFunctionCallReturnIds } from '../../core/thread-function-call/return-value.js';
import type { RunWorkletCtxData } from '../../worklet-runtime/bindings/events.js';
import { formatElementTemplateUpdateCommands } from '../debug/alog.js';
import { createElementTemplateUpdateEvent } from '../protocol/update-event.js';
import type { ElementTemplateUpdateEvent } from '../protocol/update-event.js';

export function dropDelayedRunOnMainThreadReturnIds(
  delayedRunOnMainThreadPayload: readonly { resolveId: number }[] | undefined,
): void {
  if (delayedRunOnMainThreadPayload) {
    dropFunctionCallReturnIds(delayedRunOnMainThreadPayload.map(data => data.resolveId));
  }
}

export function packElementTemplateCommitUpdateEvent(options: {
  alogHeader: string;
  isHydration?: boolean;
  delayedRunOnMainThreadData?: RunWorkletCtxData[] | undefined;
}): ElementTemplateUpdateEvent {
  if (typeof __ALOG__ !== 'undefined' && __ALOG__) {
    console.alog?.(
      `${options.alogHeader}\n`
        + JSON.stringify(
          {
            ops: formatElementTemplateUpdateCommands(globalCommitContext.ops),
            flushOptions: globalCommitContext.flushOptions,
            flowIds: globalCommitContext.flowIds,
            ...(options.isHydration ? { isHydration: true } : undefined),
            delayedRunOnMainThreadDataCount: options.delayedRunOnMainThreadData?.length,
          },
          null,
          2,
        ),
    );
  }

  return createElementTemplateUpdateEvent({
    ops: globalCommitContext.ops,
    flushOptions: globalCommitContext.flushOptions,
    ...(options.isHydration ? { isHydration: true } : undefined),
    reloadVersion: getReloadVersion(),
    flowIds: globalCommitContext.flowIds,
    delayedRunOnMainThreadData: options.delayedRunOnMainThreadData,
  });
}
