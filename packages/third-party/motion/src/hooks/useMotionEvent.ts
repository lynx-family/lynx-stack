// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MotionValue, MotionValueEventCallbacks } from 'motion-dom';

import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import type { MainThreadRef } from '@lynx-js/react';

export function useMotionValueRefEvent<
  V,
  EventName extends keyof MotionValueEventCallbacks<V>,
>(
  valueRef: MainThreadRef<MotionValue<V>>,
  event: 'change',
  callback: MotionValueEventCallbacks<V>[EventName],
): void {
  const unListenRef = useMainThreadRef<VoidFunction>();

  useEffect(() => {
    void runOnMainThread(() => {
      'main thread';
      unListenRef.current = valueRef.current.on(event, callback);
    })();
    return () => {
      void runOnMainThread(() => {
        'main thread';
        unListenRef.current?.();
      })();
    };
  }, [callback]);
}
