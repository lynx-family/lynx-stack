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

export function isSdkVersionGt(major: number, minor: number): boolean {
  const lynxSdkVersion: string = SystemInfo.lynxSdkVersion || '1.0';
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
