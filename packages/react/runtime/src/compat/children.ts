// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Children as PreactChildren } from 'preact/compat';

/**
 * Freeze an array in development mode to catch accidental mutations.
 * In production, this is a no-op for performance.
 *
 * @param arr - The array to freeze
 * @returns The same array (frozen in dev mode)
 */
function freezeDev<T extends object>(obj: T): T {
  if (__DEV__ && obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
  }
  return obj;
}

/**
 * Children utilities for working with React children.
 *
 * ReactLynx contract:
 * - These utilities are read-only operations on children
 * - In development builds, arrays returned by `toArray` are frozen to prevent
 *   accidental mutations that can break compile-time snapshot optimizations
 * - In production builds, no freeze overhead is applied
 */
export const Children = {
  /**
   * Iterate over children and call a function for each child.
   *
   * @param children - The children to iterate over
   * @param fn - Function to call for each child
   * @param ctx - Optional context for the function
   */
  forEach: PreactChildren.forEach,

  /**
   * Map over children and return a new array.
   *
   * @param children - The children to map over
   * @param fn - Function to call for each child that returns a new value
   * @param ctx - Optional context for the function
   * @returns Array of mapped values
   */
  map: PreactChildren.map,

  /**
   * Count the number of children.
   *
   * @param children - The children to count
   * @returns Number of children
   */
  count: PreactChildren.count,

  /**
   * Verify that children is a single child and return it.
   * Throws if there are zero or multiple children.
   *
   * @param children - The children to verify
   * @returns The single child
   * @throws If there are zero or multiple children
   */
  only: PreactChildren.only,

  /**
   * Convert children to a flat array.
   *
   * ReactLynx contract:
   * - The returned array is **read-only** (typed as ReadonlyArray)
   * - In development builds, the returned array is `Object.freeze`'d to
   *   surface accidental mutations (e.g. push/splice/sort) that can break
   *   compile-time snapshot optimizations
   * - In production builds, no freeze overhead is applied
   *
   * @param children - The children to convert to an array
   * @returns A read-only array of children
   */
  toArray(children: any): readonly any[] {
    const arr = PreactChildren.toArray(children);
    // Freeze to catch accidental mutation like push/splice/sort in dev
    return freezeDev(arr);
  },
} as const;
