// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { noopMT } from '../../utils/noop.js';

export interface MotionValue<T> {
  get(): T;
  set(v: T): void;
  getVelocity(): number;
  jump(v: T): void;
  onChange(callback: (v: T) => void): () => void;
  on(event: 'change', callback: (v: T) => void): () => void;
  /**
   * Internal method to update velocity, usually called by the animation loop.
   */
  updateVelocity(v: number): void;
  stop(): void;
  /**
   * Check if this MotionValue is currently animating.
   */
  isAnimating(): boolean;
  /**
   * Clear all change listeners.
   */
  clearListeners(): void;
  /**
   * Destroy this MotionValue, stopping all animations and clearing all listeners.
   */
  destroy(): void;
  /**
   * @internal
   */
  attach(cancel: () => void): () => void;
}

export function createMotionValue<T>(initial: T): MotionValue<T> {
  'main thread';
  class MotionValueImpl implements MotionValue<T> {
    v: T;
    velocity = 0;
    listeners = new Set<(v: T) => void>();
    activeAnimations = new Set<() => void>();
    lastUpdated = 0;

    constructor(initial: T) {
      this.v = initial;
    }

    get() {
      return this.v;
    }

    set(v: T) {
      const now = Date.now();
      if (typeof v === 'number' && typeof this.v === 'number') {
        const delta = v - this.v;
        const timeDelta = (now - this.lastUpdated) / 1000;
        if (timeDelta > 0) {
          // Simple instantaneous velocity
          this.velocity = delta / timeDelta;
        }
      }
      this.lastUpdated = now;
      this.v = v;
      this.notify();
    }

    updateVelocity(v: number) {
      this.velocity = v;
    }

    getVelocity() {
      return this.velocity;
    }

    jump(v: T) {
      this.v = v;
      this.velocity = 0;
      this.lastUpdated = Date.now();
      this.notify();
    }

    onChange(callback: (v: T) => void) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    on(event: 'change', callback: (v: T) => void) {
      if (event === 'change') {
        return this.onChange(callback);
      }
      return noopMT;
    }

    notify() {
      for (const cb of this.listeners) {
        cb(this.v);
      }
    }

    attach(cancel: () => void) {
      this.activeAnimations.add(cancel);
      return () => this.activeAnimations.delete(cancel);
    }

    stop() {
      for (const cancel of this.activeAnimations) {
        cancel();
      }
      this.activeAnimations.clear();
    }

    isAnimating() {
      return this.activeAnimations.size > 0;
    }

    clearListeners() {
      this.listeners.clear();
    }

    destroy() {
      this.stop();
      this.clearListeners();
    }

    toJSON() {
      return String(this.v);
    }
  }

  return new MotionValueImpl(initial);
}

export interface MotionValueEventCallbacks<V> {
  change: (v: V) => void;
}
