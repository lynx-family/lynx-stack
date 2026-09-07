// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Context } from 'preact';

export * from '@lynx-js/react';

/**
 * Starts a transition update, marking state updates in the callback as non-urgent
 *
 * Note: This is Preact's `startTransition` implementation, which differs fundamentally from React's:
 * - React marks updates as low priority with interruption and time-slicing support
 * - Preact simply executes the callback synchronously without true concurrent features
 *
 * @param cb - Callback function containing state updates, executed immediately and synchronously
 *
 * @public
 */
declare function startTransition(cb: () => void): void;
/**
 * Returns a tuple with a pending state and a startTransition function
 *
 * Note: This is Preact's `useTransition` implementation, which differs from React's:
 * - React returns `[isPending, startTransition]` where `isPending` reflects actual transition state
 * - Preact always returns `[false, startTransition]` since there's no real concurrent rendering
 * - The `isPending` value is always `false` because Preact executes transitions synchronously
 *
 * @returns A tuple containing:
 *   - isPending: Always false in Preact (unlike React where it indicates transition state)
 *   - startTransition: Function to start a transition (executes callback synchronously)
 *
 * @public
 */
declare function useTransition(): [false, typeof startTransition];

/**
 * Reads the value of a resource during render.
 *
 * Unlike the other hooks, `use` may be called conditionally and inside loops.
 *
 * - Given a promise, it returns the resolved value. While the promise is
 *   pending it suspends, so the nearest `Suspense` boundary renders its
 *   fallback; a rejected promise throws.
 * - Given a context, it returns the current value, subscribing the component
 *   to that context.
 *
 * @param resource - A promise or a context to read
 * @returns The resolved value of the promise, or the current context value
 *
 * @public
 */
declare function use<T>(resource: Promise<T> | Context<T>): T;

/**
 * Runs an effect whose write is meant to be visible to the effects that read it.
 *
 * Preact has no separate insertion phase, so ReactLynx forwards this to `useEffect`.
 * Ordering within a component still follows declaration order, and across components
 * effects run child-before-parent, which covers the pattern libraries such as
 * react-navigation use it for:
 *
 * ```js
 * useInsertionEffect(() => { optionsRef.current = options; }, [options]);
 * useEffect(() => { readsOptionsRef(); });
 * ```
 *
 * It is not React's guarantee, though. Code that only relies on the ordering above
 * keeps working if this is ever pointed at a real insertion phase.
 *
 * @param effect - Imperative function that can return a cleanup function
 * @param deps - If present, effect will only activate if the values in the list change (using ===)
 *
 * @public
 *
 * @deprecated `useInsertionEffect` in the background thread is an alias of `useEffect` and cannot offer React's insertion-phase timing: the effect has not run when `render` returns, and its cleanup is deferred to a later flush instead of running inside the unmount commit.
 */
declare const useInsertionEffect: typeof import('@lynx-js/react').useEffect;
export { startTransition, use, useInsertionEffect, useTransition };

// type for the default export
declare const _default: typeof import('@lynx-js/react') & {
  startTransition: typeof startTransition;
  use: typeof use;
  useInsertionEffect: typeof useInsertionEffect;
  useTransition: typeof useTransition;
};
export default _default;
