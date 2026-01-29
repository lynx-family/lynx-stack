// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export * from '@lynx-js/react';

import type { ReactElement, ReactNode } from 'react';

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
 * Children utilities for working with React children.
 *
 * ReactLynx contract:
 * - These utilities provide read-only operations on children
 * - `toArray` returns a `ReadonlyArray` to prevent accidental mutations
 * - In development builds, arrays returned by `toArray` are frozen with `Object.freeze`
 *   to surface accidental mutations (e.g. push/splice/sort) that can break compile-time
 *   snapshot optimizations
 * - In production builds, no freeze overhead is applied
 *
 * @public
 */
export namespace Children {
  /**
   * Convert children to a flat array.
   *
   * ReactLynx contract:
   * - The returned array is **read-only** (typed as ReadonlyArray).
   * - In development builds, the returned array is `Object.freeze`'d to
   *   surface accidental mutations (e.g. push/splice/sort) that can break
   *   compile-time snapshot optimizations.
   * - In production builds, no freeze overhead is applied.
   *
   * @param children - The children to convert to an array
   * @returns A read-only array of children
   *
   * @example
   * ```tsx
   * const arr = Children.toArray(props.children);
   * // ✅ Safe: Reading values
   * arr.forEach(child => console.log(child));
   * // ✅ Safe: Creating new array
   * const filtered = arr.filter(child => child.type === 'div');
   * // ❌ Error in TypeScript, throws in dev: Mutating array
   * arr.push(newChild);
   * ```
   */
  function toArray(children: ReactNode | ReactNode[]): ReadonlyArray<ReactNode>;

  /**
   * Count the number of children.
   *
   * @param children - The children to count
   * @returns Number of children
   */
  function count(children: ReactNode | ReactNode[]): number;

  /**
   * Verify that children is a single child and return it.
   * Throws if there are zero or multiple children.
   *
   * @param children - The children to verify
   * @returns The single child
   * @throws If there are zero or multiple children
   */
  function only(children: ReactNode | ReactNode[]): ReactElement;

  /**
   * Iterate over children and call a function for each child.
   *
   * @param children - The children to iterate over
   * @param fn - Function to call for each child
   * @param ctx - Optional context for the function
   */
  function forEach(
    children: ReactNode | ReactNode[],
    fn: (child: ReactNode, index: number) => void,
    ctx?: any,
  ): void;

  /**
   * Map over children and return a new array.
   *
   * @param children - The children to map over
   * @param fn - Function to call for each child that returns a new value
   * @param ctx - Optional context for the function
   * @returns Array of mapped values
   */
  function map<T>(
    children: ReactNode | ReactNode[],
    fn: (child: ReactNode, index: number) => T,
    ctx?: any,
  ): T[];
}

export { Children, startTransition, useTransition };

// type for the default export
declare const _default: typeof import('@lynx-js/react') & {
  Children: typeof Children;
  startTransition: typeof startTransition;
  useTransition: typeof useTransition;
};
export default _default;
