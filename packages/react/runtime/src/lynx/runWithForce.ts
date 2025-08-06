// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { COMPONENT, DIFF2, FORCE } from '../renderToOpcodes/constants.js';

export function runWithForce(cb: () => void): void {
  const oldDiff = options[DIFF2];
  options[DIFF2] = (vnode: VNode, oldVNode: VNode) => {
    /* v8 ignore start */
    if (oldDiff) {
      oldDiff(vnode, oldVNode);
    }
    /* v8 ignore stop */

    const c = oldVNode[COMPONENT];
    if (c) {
      c[FORCE] = true;
    } else {
      // mount phase of a new Component
      // `isNew` is true, no need to set FORCE
    }
  };

  try {
    cb();
  } finally {
    options[DIFF2] = oldDiff as (vnode: VNode, oldVNode: VNode) => void;
  }
}
