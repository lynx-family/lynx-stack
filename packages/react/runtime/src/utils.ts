// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentClass } from 'preact';

import { getCurrentVNode, getOwnerStack } from './shared/component-stack.js';

/* v8 ignore start */
export const noop: (...args: unknown[]) => unknown = () => {};
/* v8 ignore end */

/**
 * Compares a candidate new value with the currently committed old value.
 *
 * The first argument must be the new value because circular-reference checks
 * only track that value's current recursion path. A repeated new object throws
 * even after the values are known to differ, preventing a circular value from
 * being committed. Entries are removed while unwinding so acyclic shared
 * references in sibling branches are still compared normally.
 */
export function isDirectOrDeepEqual(
  newObj: unknown,
  oldObj: unknown,
  ancestors?: object[],
): boolean {
  // Equal root values do not need to be committed, so they do not need a
  // circular-reference check. Equal nested objects still need checking when
  // another part of the root value causes the whole value to be committed.
  if (newObj === oldObj) {
    if (!newObj || typeof newObj !== 'object' || !ancestors?.length) {
      return true;
    }
  } else if (!newObj || typeof newObj !== 'object') {
    return false;
  }

  ancestors ??= [];
  const isRoot = ancestors.length === 0;
  let isTracked = false;
  try {
    if (ancestors.includes(newObj)) {
      throw new TypeError(`Cannot compare circular structures`);
    }

    const newKeys = Object.keys(newObj);
    const oldIsObject = !!oldObj && typeof oldObj === 'object';
    let isEqual = oldIsObject && newKeys.length === Object.keys(oldObj).length;
    const newRecord = newObj as Record<string, unknown>;
    const oldRecord = oldObj as Record<string, unknown>;

    ancestors.push(newObj);
    isTracked = true;
    for (let index = 0; index < newKeys.length; index++) {
      const key = newKeys[index]!;
      const newValue = newRecord[key];

      // Once a difference is found, only keep checking objects from the new
      // value for circular references. Avoid all remaining old-value work and
      // recursive calls for primitives.
      if (!isEqual) {
        if (newValue && typeof newValue === 'object') {
          isDirectOrDeepEqual(newValue, undefined, ancestors);
        }
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(oldObj, key)) {
        isEqual = false;
        if (newValue && typeof newValue === 'object') {
          isDirectOrDeepEqual(newValue, undefined, ancestors);
        }
      } else if (!isDirectOrDeepEqual(newValue, oldRecord[key], ancestors)) {
        isEqual = false;
      }
    }
    return isEqual;
  } catch (error) {
    if (isRoot && __DEV__ && /circular|cyclic/i.test((error as Error).message)) {
      // JavaScript engines give this different errors name and messages:
      // PrimJS: "circular reference"
      // JavaScriptCore: "JSON.stringify cannot serialize cyclic structures"
      // V8: "Converting circular structure to JSON"
      const vnode = getCurrentVNode();
      if (vnode) {
        const stack = getOwnerStack(vnode);
        (error as Error).message += `\n\n${stack}`;
      }
    }
    throw error;
  } finally {
    if (isTracked) {
      ancestors.pop();
    }
  }
}

export function isEmptyObject(obj?: object): obj is Record<string, never> {
  for (const _ in obj) return false;
  return true;
}

export function isSdkVersionGt(major: number, minor: number): boolean {
  const lynxSdkVersion: string = SystemInfo.lynxSdkVersion ?? '1.0';
  const version = lynxSdkVersion.split('.');
  return Number(version[0]) > major || (Number(version[0]) == major && Number(version[1]) > minor);
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: Iterable<K>): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Pick<T, K>;
}

export function maybePromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === 'object'
    && value !== null
    // @ts-expect-error the check is safe
    && typeof value.then === 'function'
  );
}

export function getDisplayName(type: ComponentClass): string {
  return type.displayName ?? type.name;
}

export function hook<T, K extends keyof T>(
  object: T,
  key: K,
  fn: Required<T>[K] extends (...args: infer P) => infer Q ? ((old?: T[K], ...args: P) => Q)
    : never,
): void {
  const oldFn = object[key];
  object[key] = function(this: T, ...args: unknown[]) {
    return fn.call(this, oldFn, ...args);
  } as T[K];
}

export const lynxQueueMicrotask: typeof lynx.queueMicrotask = /* @__PURE__ */ (() => {
  if (lynx.queueMicrotask) {
    return (fn) => lynx.queueMicrotask(fn);
  } else if (typeof globalThis.Promise === 'function') {
    const resolved = globalThis.Promise.resolve();
    /* v8 ignore start */
    return (fn) => {
      // Schedule as a microtask, and surface exceptions like queueMicrotask would.
      resolved.then(fn).catch((err) => {
        setTimeout(() => {
          throw err;
        }, 0);
      });
    };
  } else {
    // Fallback to macrotask when microtasks aren't available.
    return (fn) => {
      setTimeout(fn, 0);
    };
  }
  /* v8 ignore stop */
})();
