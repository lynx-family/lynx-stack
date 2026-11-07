// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getCurrentVNode, getOwnerStack } from './component-stack.js';

export function isDirectOrDeepEqual(a: unknown, b: unknown): boolean {
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
