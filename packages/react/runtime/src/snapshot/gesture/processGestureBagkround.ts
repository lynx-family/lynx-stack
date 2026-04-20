// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { GestureTypeInner } from './types.js';
import type { BaseGesture, ComposedGesture, GestureKind } from './types.js';
import { onPostWorkletCtx } from '../worklet/ctx.js';

function prepareWorkletForCommit(value: Worklet): Worklet | null {
  // Copy-on-commit: keep the background-side gesture/worklet objects clean.
  // `_execId` is injected into the payload object that will be sent to the main thread.
  const copy = { ...(value as unknown as Record<string, unknown>) } as unknown as Worklet;
  return onPostWorkletCtx(copy);
}

function removeUndefinedFields(record: Record<string, unknown>): Record<string, unknown> {
  const filteredEntries = Object.entries(record).filter(([, value]) => value !== undefined);
  return Object.fromEntries(filteredEntries);
}

function serializeCommittedGesture(gesture: GestureKind): Record<string, unknown> {
  if (gesture.type === GestureTypeInner.COMPOSED) {
    const composed = gesture as ComposedGesture;
    return {
      type: composed.type,
      gestures: composed.gestures.map((subGesture) => serializeCommittedGesture(subGesture)),
      __isSerialized: true,
    };
  }

  const baseGesture = gesture as BaseGesture;
  return removeUndefinedFields({
    config: baseGesture.config,
    id: baseGesture.id,
    type: baseGesture.type,
    simultaneousWith: baseGesture.simultaneousWith?.map(subGesture => ({
      id: subGesture.id,
    })) ?? [],
    waitFor: baseGesture.waitFor?.map(subGesture => ({ id: subGesture.id })) ?? [],
    continueWith: baseGesture.continueWith?.map(subGesture => ({
      id: subGesture.id,
    })) ?? [],
    callbacks: baseGesture.callbacks,
    __isSerialized: true,
  });
}

function attachCommittedSerializer<TGesture extends GestureKind>(gesture: TGesture): TGesture {
  const serialize = () => serializeCommittedGesture(gesture);

  return Object.assign(gesture as Record<string, unknown>, {
    serialize,
    toJSON: serialize,
  }) as TGesture;
}

/**
 * Prepare a gesture payload to be sent to the main thread.
 *
 * This function returns a copy of the input object and injects `_execId` into
 * its worklet callbacks. The background-side gesture object MUST NOT be mutated,
 * otherwise `_execId` churn would pollute the cached values and cause redundant patches.
 */
export function prepareGestureForCommit(gesture: GestureKind): GestureKind {
  if (gesture.type === GestureTypeInner.COMPOSED) {
    const composed = gesture as ComposedGesture;
    const committed: ComposedGesture = {
      ...composed,
      gestures: composed.gestures.map((g) => prepareGestureForCommit(g)),
    };
    return attachCommittedSerializer(committed);
  }

  const baseGesture = gesture as BaseGesture;
  const committedCallbacks: BaseGesture['callbacks'] = { ...baseGesture.callbacks };
  for (const name of Object.keys(committedCallbacks)) {
    const callback = committedCallbacks[name];
    if (callback == null) {
      // Some gesture implementations may intentionally leave callbacks unset.
      // Treat null/undefined as "no handler" and keep it untouched.
      continue;
    }
    // `onPostWorkletCtx` may report errors and return null depending on runtime configuration.
    // Keep behavior consistent with the previous implementation (which used `!`).
    committedCallbacks[name] = prepareWorkletForCommit(callback)!;
  }

  const committed: BaseGesture = {
    ...baseGesture,
    callbacks: committedCallbacks,
  };
  return attachCommittedSerializer(committed);
}
