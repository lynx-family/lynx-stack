// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MotionValue } from 'motion-dom';

import { runOnMainThread, useMainThreadRef, useMemo } from '@lynx-js/react';
import type { MainThreadRef } from '@lynx-js/react';
import { runWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type {
  Worklet,
  WorkletRef,
} from '@lynx-js/react/worklet-runtime/bindings';

import { motionValue } from '../animation/index.js';

export function useMotionValueRefCore<T, MV>(
  value: T,
  make: (v: T) => MV,
): MainThreadRef<MV> {
  // @ts-expect-error - useMainThreadRef doesn't require initial value but TypeScript expects it
  // This is safe because we initialize it in the useMemo below before any usage
  const motionValueRef: MainThreadRef<MV> = useMainThreadRef<MV>();

  useMemo(() => {
    function setMotionValue(value: T) {
      'main thread';
      if (!motionValueRef.current) {
        motionValueRef.current = make(value);
      }
    }
    if (__BACKGROUND__) {
      void runOnMainThread(setMotionValue)(value);
    } else {
      // Type assertion needed to bridge between worklet runtime and motion value types
      runWorkletCtx(setMotionValue as unknown as Worklet, [
        value as WorkletRef<unknown>,
      ]);
    }
  }, []);

  return motionValueRef;
}

/**
 * @experimental useMotionValue, but in MainThreadRef format, highly experimental, subject to change
 */
export function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>> {
  return useMotionValueRefCore(value, motionValue);
}
