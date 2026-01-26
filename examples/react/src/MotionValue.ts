/**
 * MotionValue POC using the MainThreadValue base class.
 *
 * This demonstrates how third-party packages can create their own
 * main thread value types by extending MainThreadValue.
 */
import { MainThreadValue, useMemo } from '@lynx-js/react';

/**
 * A simple motion value that can be accessed on the main thread.
 * Uses `.value` instead of `.current` to demonstrate the new extensibility.
 */
export class MotionValue<T> extends MainThreadValue<T> {
  private _subscribers: Set<(value: T) => void> = new Set();

  constructor(initValue: T, type = '@example/motion-value') {
    super(initValue, type);
  }

  /**
   * Get the current value. Only works on main thread.
   */
  get value(): T {
    try {
      return this.getValueOnMainThread();
    } catch (_e) {
      // Allow access on background thread for capture (returns undefined/garbage, which is ignored)
      return this._initValue;
    }
  }

  /**
   * Set the current value. Only works on main thread.
   * Notifies all subscribers when value changes.
   */
  set value(v: T) {
    this.setValueOnMainThread(v);
    // Notify subscribers
    this._subscribers.forEach(cb => cb(v));
  }

  /**
   * Subscribe to value changes.
   * @param callback - Called with the new value when it changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (value: T) => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }
}

// Register for runtime hydration
MainThreadValue.register(MotionValue, '@example/motion-value');

/**
 * Hook to create a MotionValue that persists across renders.
 */
export function useMotionValue<T>(initValue: T): MotionValue<T> {
  return useMemo(() => new MotionValue(initValue), []);
}
