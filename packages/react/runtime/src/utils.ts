// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentClass } from 'preact';

import { getCurrentVNode, getOwnerStack } from './debug/component-stack.js';

export function isDirectOrDeepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  try {
    if (
      typeof a == 'object' && a !== null && typeof b == 'object' && b !== null
      && JSON.stringify(a) === JSON.stringify(b)
    ) {
      return true;
    }
  } catch (error) {
    if (__DEV__ && /circular|cyclic/i.test((error as Error).message)) {
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
  }
  return false;
}

export function isEmptyObject(obj?: object): obj is Record<string, never> {
  for (const _ in obj) return false;
  return true;
}

export function safeMtsSystemInfo(): typeof SystemInfo {
  if (typeof SystemInfo !== 'undefined') {
    return SystemInfo;
  }

  const { SystemInfo: lynxSystemInfo } = lynx as unknown as { SystemInfo?: typeof SystemInfo };
  return lynxSystemInfo ?? {/* empty obj for unit tests */} as typeof SystemInfo;
}

export function isSdkVersionGt(major: number, minor: number): boolean {
  const lynxSdkVersion: string = safeMtsSystemInfo().lynxSdkVersion ?? '1.0';
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
