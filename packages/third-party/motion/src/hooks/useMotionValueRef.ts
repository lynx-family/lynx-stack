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

export function useMotionValueRef<T>(value: T): MainThreadRef<MotionValue<T>> {
  // @ts-expect-error expected
  const motionValueRef: MainThreadRef<MotionValue<T>> = useMainThreadRef<
    MotionValue<T>
  >();

  useMemo(() => {
    function setMotionValue(value: T) {
      'main thread';
      if (!motionValueRef.current) {
        motionValueRef.current = motionValue<T>(value);
      }
    }
    if (__BACKGROUND__) {
      void runOnMainThread(setMotionValue)(value);
    } else {
      runWorkletCtx(setMotionValue as unknown as Worklet, [
        value as WorkletRef<unknown>,
      ]);
    }
  }, []);

  return motionValueRef;
}
