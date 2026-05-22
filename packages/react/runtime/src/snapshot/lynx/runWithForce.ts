// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';

import { runWithForceRootRender } from '../../core/forceRootRender.js';
import { __root } from '../../root.js';

export function runWithForce(cb: () => void): void {
  runWithForceRootRender({
    getRootVNode: () => __root.__jsx,
    setRootVNode: (vnode: VNode) => {
      // @ts-expect-error: __root.__jsx is a Preact VNode during background force render.
      __root.__jsx = vnode;
    },
    render: cb,
  });
}
