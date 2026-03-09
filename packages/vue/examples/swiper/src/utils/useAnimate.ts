// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * useAnimate — RAF-based animation composable for Main Thread.
 *
 * Port of React Lynx's utils/useAnimate.ts.
 * All MTS function bodies are identical to the React version.
 */

import { useMainThreadRef } from '@lynx-js/vue-runtime';

export interface AnimationOptions {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  easing?: (t: number) => number;
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}

// Common easing functions
export const easings = {
  linear: (t: number) => {
    'main thread';
    return t;
  },
  easeInQuad: (t: number) => {
    'main thread';
    return t * t;
  },
  easeOutQuad: (t: number) => {
    'main thread';
    return 1 - (1 - t) * (1 - t);
  },
  easeInOutQuad: (t: number) => {
    'main thread';
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
};

function animateInner(options: AnimationOptions) {
  'main thread';
  const {
    from,
    to,
    duration = 5000,
    delay = 0,
    easing = easings.easeInOutQuad,
    onUpdate,
    onComplete,
  } = options;

  let startTs = 0;
  let rafId = 0;

  function tick(ts: number) {
    const progress =
      Math.max(Math.min(((ts - startTs - delay) * 100) / duration, 100), 0)
      / 100;

    const easedProgress = easing(progress);
    const currentValue = from + (to - from) * easedProgress;
    onUpdate?.(currentValue);
  }

  function updateRafId(id: number) {
    rafId = id;
  }

  function step(ts: number) {
    if (!startTs) {
      startTs = Number(ts);
    }
    // make sure progress can reach 100%
    if (ts - startTs <= duration + 100) {
      tick(ts);
      updateRafId(requestAnimationFrame(step));
    } else {
      onComplete?.();
    }
  }

  updateRafId(requestAnimationFrame(step));

  function cancel() {
    cancelAnimationFrame(rafId);
  }

  return {
    cancel,
  };
}

export function useAnimate() {
  const lastCancelRef = useMainThreadRef<(() => void) | null>(null);

  function cancel() {
    'main thread';
    lastCancelRef.current?.();
  }

  function animate(options: AnimationOptions) {
    'main thread';
    cancel();

    const { cancel: innerCancel } = animateInner(options);
    lastCancelRef.current = innerCancel;
  }

  return {
    cancel,
    animate,
  };
}
