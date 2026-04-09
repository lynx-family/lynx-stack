// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, EventCtx, RunWorkletOptions } from './bindings/types.js';
import { RunWorkletSource } from './bindings/types.js';

// EventResult enum values
export const EventResult = {
  kDefault: 0x0,
  kStopPropagationMask: 0x1,
  kStopImmediatePropagationMask: 0x2,
} as const;

type EventLike = Record<string, ClosureValueType>;

export function isEventObject(
  ctx: ClosureValueType[],
  options?: RunWorkletOptions,
): ctx is [EventLike, ...ClosureValueType[]] {
  if (!Array.isArray(ctx) || typeof ctx[0] !== 'object' || ctx[0] === null) {
    return false;
  }
  if (options && options.source === RunWorkletSource.EVENT) {
    return true;
  }
  return false;
}

/**
 * Add event methods to an event object if needed
 * @param ctx The event object to enhance
 * @param options The run worklet options
 * @returns A tuple of boolean and the event return result
 */
export function addEventMethodsIfNeeded(ctx: ClosureValueType[], options?: RunWorkletOptions): [boolean, EventCtx] {
  if (!isEventObject(ctx, options)) {
    return [false, {}];
  }
  const eventCtx: EventCtx = {};
  const eventObj = ctx[0];

  // Add stopPropagation method
  eventObj['stopPropagation'] = function() {
    eventCtx._eventReturnResult = (eventCtx._eventReturnResult ?? EventResult.kDefault)
      | EventResult.kStopPropagationMask;
  };

  // Add stopImmediatePropagation method
  eventObj['stopImmediatePropagation'] = function() {
    eventCtx._eventReturnResult = (eventCtx._eventReturnResult ?? EventResult.kDefault)
      | EventResult.kStopImmediatePropagationMask;
  };

  return [true, eventCtx];
}
