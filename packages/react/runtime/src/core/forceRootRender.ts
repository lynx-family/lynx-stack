// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options as preactOptions } from 'preact';
import type { VNode } from 'preact';

import { COMPONENT, DIFF2, FORCE, ORIGINAL } from '../shared/render-constants.js';

export interface ForceRootRenderOptions {
  getRootVNode: () => unknown;
  setRootVNode: (vnode: VNode) => void;
  render: () => void;
}

export function runWithForceRootRender(
  { getRootVNode, setRootVNode, render }: ForceRootRenderOptions,
): void {
  // Preact can skip root render if `_original` is unchanged; bumping it keeps
  // backend force renders aligned with Preact's own rerender path.
  const rootVNode = getRootVNode();
  if (rootVNode) {
    const newVNode = Object.assign({}, rootVNode) as VNode;
    if (newVNode[ORIGINAL] != null) {
      newVNode[ORIGINAL] += 1;
      setRootVNode(newVNode);
    }
  }

  const oldDiff = preactOptions[DIFF2];
  preactOptions[DIFF2] = (vnode: VNode, oldVNode: VNode) => {
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
    render();
  } finally {
    preactOptions[DIFF2] = oldDiff as (vnode: VNode, oldVNode: VNode) => void;
  }
}
