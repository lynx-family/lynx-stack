// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { isMainThreadFunction } from '../../core/main-thread-function.js';
import {
  registerMainThreadBackgroundFunctionCtx,
  retainMainThreadBackgroundFunctionCtx,
} from '../runtime/template/main-thread-background-function.js';
import type { MTEventCtx } from '../runtime/template/main-thread-event-ctx.js';

interface GestureInput {
  type: number;
  id: number;
  __isGesture?: boolean;
  __isSerialized?: boolean;
  gestures?: GestureInput[];
  config?: Record<string, unknown>;
  callbacks: Record<string, MTEventCtx | null | undefined>;
  waitFor?: { id: number }[];
  simultaneousWith?: { id: number }[];
  continueWith?: { id: number }[];
}

export interface GestureDescriptor {
  id: number;
  type: number;
  config: Record<string, unknown>;
  callbacks: { name: string; callback: MTEventCtx }[];
  relationMap: {
    waitFor: number[];
    simultaneous: number[];
    continueWith: number[];
  };
}

export interface GestureSlotValue {
  type: 'gesture';
  value: GestureDescriptor[];
}

// Provenance stays outside the wire value. A repeated prepare before native
// delivery must reuse its registered ctx, while mutable Gesture config is copied.
const callbackSources = new WeakMap<MTEventCtx, MTEventCtx>();

export function prepareGestureForNative(
  value: unknown,
  previous?: GestureSlotValue | null,
): GestureSlotValue | null {
  if (value == null || value === false) {
    return null;
  }
  if (
    typeof value !== 'object'
    || !((value as GestureInput).__isGesture === true || (value as GestureInput).__isSerialized === true)
  ) {
    throw new Error('ElementTemplate main-thread:gesture expects a Gesture object.');
  }

  const descriptors: GestureDescriptor[] = [];
  const seen = new Set<number>();
  function append(gesture: GestureInput): void {
    if (gesture.type === -1) {
      for (const child of gesture.gestures!) {
        append(child);
      }
      return;
    }
    if (seen.has(gesture.id)) {
      return;
    }
    seen.add(gesture.id);
    const callbacks: GestureDescriptor['callbacks'] = [];
    const previousGesture = previous?.value.find(item => item.id === gesture.id);
    for (const name of Object.keys(gesture.callbacks)) {
      const rawCallback = gesture.callbacks[name];
      if (rawCallback == null) {
        continue;
      }
      if (!isMainThreadFunction(rawCallback)) {
        throw new Error(`Gesture callback '${name}' must be a main-thread function.`);
      }
      const previousCallback = previousGesture?.callbacks.find(item => item.name === name)?.callback;
      let callback = previousCallback;
      if (!callback || callbackSources.get(callback) !== rawCallback) {
        callback = { ...rawCallback };
        callbackSources.set(callback, rawCallback);
        registerMainThreadBackgroundFunctionCtx(callback);
      }
      callbacks.push({ name, callback });
    }
    descriptors.push({
      id: gesture.id,
      type: gesture.type,
      config: { ...gesture.config },
      callbacks,
      relationMap: {
        waitFor: gesture.waitFor?.map(item => item.id) ?? [],
        simultaneous: gesture.simultaneousWith?.map(item => item.id) ?? [],
        continueWith: gesture.continueWith?.map(item => item.id) ?? [],
      },
    });
  }
  append(value as GestureInput);
  return { type: 'gesture', value: descriptors };
}

export function retainGestureCallbacks(value: GestureSlotValue): void {
  for (const gesture of value.value) {
    for (const { callback } of gesture.callbacks) {
      retainMainThreadBackgroundFunctionCtx(callback);
    }
  }
}

export function hydrateGestureCallbacks(value: GestureSlotValue, previous: GestureSlotValue): void {
  // IDs belong to independent thread-local allocators. Pair each type in
  // declaration order; the worklet hydrator also checks callback source identity.
  const remaining = previous.value.slice();
  for (const gesture of value.value) {
    const index = remaining.findIndex(old => old.type === gesture.type);
    if (index === -1) {
      continue;
    }
    const oldGesture = remaining.splice(index, 1)[0]!;
    for (const { name, callback } of gesture.callbacks) {
      const oldCallback = oldGesture.callbacks.find(item => item.name === name)?.callback;
      if (oldCallback) {
        hydrateWorkletCtx(callback as Worklet, oldCallback as Worklet);
      }
    }
  }
}
