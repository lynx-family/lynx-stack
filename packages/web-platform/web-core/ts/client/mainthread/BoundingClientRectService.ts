// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { requestIdleCallbackImpl } from './utils/requestIdleCallback.js';

/**
 * Minimum spacing between idle-time cache invalidations, in milliseconds.
 *
 * 240 ms ≈ one full cycle of the "Model Human Processor" (Card, Moran &
 * Newell, *The Psychology of Human-Computer Interaction*, 1983): ~100 ms
 * perceptual + ~70 ms cognitive + ~70 ms motor processing — the time it
 * takes a person to perceive a stimulus, decide on a response, and
 * produce it. It also falls within the typical sustained-input window for
 * finger tapping (~2–7 Hz, varying with task and stimulus modality), so
 * cache staleness on this timescale stays at or below the threshold at
 * which a user can issue a distinct, intentional next input. Throttling
 * idle-time invalidation here keeps `getBoundingClientRect` off the hot
 * path while bounding cache lag during idle to ~250 ms.
 *
 * References:
 * - MHP cycle-time table (citing Card, Moran & Newell 1983):
 *   https://en.wikipedia.org/wiki/Human_processor_model
 * - Tapping-rate ranges and limits:
 *   https://pmc.ncbi.nlm.nih.gov/articles/PMC2670435/
 */
const MIN_IDLE_INVALIDATION_INTERVAL_MS = 240;

export class BoundingClientRectService {
  readonly #parentDom: HTMLElement;
  #cachedRect: DOMRect = new DOMRect(0, 0, 0, 0);
  #dirty = true;
  #idleScheduled = false;
  #lastIdleInvalidation = 0;
  #disposed = false;

  constructor(parentDom: HTMLElement) {
    this.#parentDom = parentDom;
    parentDom.addEventListener(
      'transitionend',
      this.#onAnimationOrTransitionEnd,
    );
    parentDom.addEventListener(
      'animationend',
      this.#onAnimationOrTransitionEnd,
    );
  }

  getLynxViewRect(): DOMRect {
    if (this.#dirty && !this.#disposed) {
      this.#cachedRect = this.#parentDom.getBoundingClientRect();
      this.#dirty = false;
    }
    this.#scheduleIdleInvalidation();
    return this.#cachedRect;
  }

  dispose(): void {
    this.#disposed = true;
    this.#parentDom.removeEventListener(
      'transitionend',
      this.#onAnimationOrTransitionEnd,
    );
    this.#parentDom.removeEventListener(
      'animationend',
      this.#onAnimationOrTransitionEnd,
    );
  }

  // Idle-time invalidation, throttled to MIN_IDLE_INVALIDATION_INTERVAL_MS.
  // Catches drifts (e.g., transform, scroll) that no other invalidation
  // path observes, without paying for a per-frame re-measurement.
  #scheduleIdleInvalidation(): void {
    if (this.#idleScheduled || this.#disposed) return;
    this.#idleScheduled = true;
    requestIdleCallbackImpl(() => {
      this.#idleScheduled = false;
      if (this.#disposed) return;
      const now = performance.now();
      if (
        now - this.#lastIdleInvalidation < MIN_IDLE_INVALIDATION_INTERVAL_MS
      ) {
        return;
      }
      this.#lastIdleInvalidation = now;
      this.#dirty = true;
    });
  }

  // Only invalidate on transitions/animations of the lynx-view itself —
  // events bubbling from descendants (including across the shadow boundary,
  // which retargets `event.target` to the host) cannot move the lynx-view.
  #onAnimationOrTransitionEnd = (event: Event): void => {
    if (event.composedPath()[0] !== this.#parentDom) return;
    this.#dirty = true;
  };
}
