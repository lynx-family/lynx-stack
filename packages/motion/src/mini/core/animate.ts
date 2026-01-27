// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  anticipate,
  backIn,
  backInOut,
  backOut,
  circIn,
  circInOut,
  circOut,
  easeIn,
  easeInOut,
  easeOut,
  linear,
} from './easings.js';
import type { MotionValue } from './MotionValue.js';
import { spring } from './spring.js';

export type Easing = (t: number) => number;

export interface AnimationOptions {
  type?: 'spring' | 'keyframes' | 'decay';
  stiffness?: number;
  damping?: number;
  mass?: number;
  duration?: number;
  ease?: Easing;
  from?: number;
  to?: number;
  velocity?: number;
  onUpdate?: (v: number) => void;
  onComplete?: () => void;
}

// --- Easings ---

// --- Easings ---

export {
  anticipate,
  backIn,
  backInOut,
  backOut,
  circIn,
  circInOut,
  circOut,
  easeIn,
  easeInOut,
  easeOut,
  linear,
};

// --- Animate ---

export function animate(
  value: MotionValue<number> | number | ((v: number) => void),
  target: number,
  options: AnimationOptions = {},
): {
  stop: () => void;
  then: (cb: () => void) => Promise<void>;
  onFinish: () => void;
} {
  'main thread';
  let currentV = 0;
  let startVelocity = options.velocity ?? 0;

  // Resolve start value
  if (typeof value === 'number') {
    currentV = value;
  } else if (typeof value === 'function') {
    // If passed a setter, we can't easily read, assume 0 or options.from
    currentV = options.from ?? 0;
  } else {
    currentV = value.get();
    startVelocity = startVelocity || value.getVelocity();
    if (value.stop) {
      value.stop();
    }
  }

  // If type is spring or no duration provided, default to spring.
  // Unless ease is provided, then tween.
  const isSpring = options.type === 'spring'
    || (!options.ease && !options.duration && options.type !== 'keyframes');

  const { from: _from, to: _to, ...springOptions } = options;

  // motion-dom spring() returns an animation generator with .next(t)
  const solver = isSpring
    ? spring({
      ...springOptions,
      keyframes: [currentV, target],
      velocity: startVelocity,
    })
    : null;

  const startTime = Date.now();
  let canceled = false;

  let resolvePromise: (() => void) | undefined;
  const completionPromise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  let detach: (() => void) | undefined;

  const controls = {
    stop: () => {
      canceled = true;
      detach?.();
    },
    then: (cb: () => void) => {
      controls.onFinish = cb;
      return completionPromise; // Return actual promise that resolves on completion
    },
    // biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
    onFinish: () => {},
  };

  const duration = options.duration ?? 0.3;
  const ease = options.ease ?? easeOut;

  if (
    typeof value === 'object' && value && 'attach' in value
    && typeof value.attach === 'function'
  ) {
    detach = value.attach(controls.stop);
  }

  const tick = () => {
    if (canceled) return;

    const now = Date.now();
    const elapsed = (now - startTime) / 1000; // seconds
    const elapsedMs = now - startTime; // milliseconds

    let finished = false;
    let current = 0;

    if (isSpring && solver) {
      // motion-dom spring generator expects time in milliseconds usually
      const state = solver.next(elapsedMs) as { value: number; done: boolean };
      current = state.value;
      finished = state.done;
    } else {
      // Tween
      if (elapsed >= duration) {
        finished = true;
        current = target;
      } else {
        const p = elapsed / duration;
        const eased = ease(p);
        current = currentV + (target - currentV) * eased;
      }
    }

    // Determine how to update
    if (typeof value === 'function') {
      value(current);
    } else if (typeof value === 'object' && value.set) {
      value.set(current);
    }

    if (options.onUpdate) {
      options.onUpdate(current);
    }

    if (finished) {
      // Ensure final frame is exact for tween
      if (!isSpring) {
        if (typeof value === 'function') {
          value(target);
        } else if (typeof value === 'object' && value.set) {
          value.set(target);
          value.updateVelocity(0);
        }
      }

      if (options.onComplete) {
        options.onComplete();
      }
      controls.onFinish();
      resolvePromise?.(); // Resolve the promise when animation completes
      detach?.();
    } else {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
  return controls;
}
