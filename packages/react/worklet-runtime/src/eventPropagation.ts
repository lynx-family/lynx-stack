// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, EventCtx } from './bindings/types.js';
import { isSdkVersionGt } from './utils/version.js';

// EventResult enum values
export const EventResult = {
  kDefault: 0x0,
  kStopPropagationMask: 0x1,
  kStopImmediatePropagationMask: 0x2,
} as const;

type EventLike = Record<string, ClosureValueType>;

export function isEventObject(ctx: ClosureValueType[]): ctx is [EventLike, ...ClosureValueType[]] {
  if (!Array.isArray(ctx) || typeof ctx[0] !== 'object') {
    return false;
  }
  const eventObj = ctx[0] as Record<string, ClosureValueType>;
  if (eventObj && 'target' in eventObj && 'currentTarget' in eventObj) {
    return true;
  }
  return false;
}

/**
 * Adds event propagation methods to an event object
 * @param eventObj The event object to enhance
 */
export function addEventPropagationMethods(ctx: [EventLike, ...ClosureValueType[]], eventCtx: EventCtx): void {
  const eventObj = ctx[0];

  // Add stopPropagation method
  eventObj['stopPropagation'] = function() {
    if (!isSdkVersionGt(3, 4)) {
      throw new Error('stopPropagation requires Lynx sdk version 3.5');
    }
    eventCtx._eventReturnResult = (eventCtx._eventReturnResult ?? EventResult.kDefault)
      | EventResult.kStopPropagationMask;
  };

  // Add stopImmediatePropagation method
  eventObj['stopImmediatePropagation'] = function() {
    if (!isSdkVersionGt(3, 4)) {
      throw new Error('stopImmediatePropagation requires Lynx sdk version 3.5');
    }
    eventCtx._eventReturnResult = (eventCtx._eventReturnResult ?? EventResult.kDefault)
      | EventResult.kStopImmediatePropagationMask;
  };
}
