// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { VNode } from 'preact';

import { COMPONENT, DIFF2, FORCE, ORIGINAL } from '../renderToOpcodes/constants.js';
import { __root } from '../root.js';

export function runWithForce(cb: () => void): void {
  // In https://github.com/preactjs/preact/pull/4724, preact will
  // skip render if the `vnode._original` is not changed, even if `c._force` is true
  // So we need to increment `vnode._original` to make sure the `__root.__jsx` is re-rendered
  // This is the same logic with: https://github.com/preactjs/preact/blob/43178581442fa0f2428e5bdbca355860b2d12e5d/src/component.js#L131
  if (__root.__jsx) {
    const newVNode = Object.assign({}, __root.__jsx) as unknown as VNode;
    if (newVNode[ORIGINAL] != null) {
      newVNode[ORIGINAL] += 1;
      // @ts-expect-error: __root.__jsx is a VNode
      __root.__jsx = newVNode;
    }
  }

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
