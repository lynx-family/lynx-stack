// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';
import { options } from 'preact';

import { CATCH_ERROR, COMPONENT, DIFF, VNODE } from '../renderToOpcodes/constants.js';

type FakeVNode = VNode;
type DelayedUnmounts = (() => void)[];
let delayedUnmounts: DelayedUnmounts = [];
let parentVNode: FakeVNode | undefined;

function takeDelayedUnmounts(): DelayedUnmounts {
  const ret = delayedUnmounts;
  delayedUnmounts = [];
  // not clearing `parentVNode` here, which would be cleared before next diff in `options[DIFF]`
  return ret;
}

function runDelayedUnmounts(delayedUnmounts: DelayedUnmounts): void {
  for (const fn of delayedUnmounts) {
    fn();
  }
}

/**
 * Delay `componentWillUnmount` until main thread patching finishes.
 */
function initDelayUnmount(): void {
  const oldUnmount = options.unmount;
  options.unmount = (vnode: VNode) => {
    if (!parentVNode) {
      // `parentVNode` is the first vnode to unmount,
      // which is needed to find proper error boundary when running `componentWillUnmount`.
      // Shallow copy vnode to prevent modification to vnode in preact unmounting process.
      parentVNode = { ...vnode };

      const oldDiff = options[DIFF] as (vnode: VNode) => void;
      options[DIFF] = (vnode: VNode) => {
        // A new diff indicates that the unmounting process of parentVNode is finished.
        parentVNode = undefined;
        options[DIFF] = oldDiff;
        oldDiff?.(vnode);
      };
    }

    const component = vnode[COMPONENT];
    if (component) {
      if (oldUnmount) {
        const vnode_clone = { ...vnode };
        delayedUnmounts.push(() => {
          const v = vnode_clone[COMPONENT]![VNODE] as VNode<{}> | null;
          vnode_clone[COMPONENT]![VNODE] = vnode_clone;
          oldUnmount?.(vnode_clone);
          vnode_clone[COMPONENT]![VNODE] = v;
        });
      }
      if (component.componentWillUnmount) {
        const unmount = component.componentWillUnmount;
        // @ts-ignore
        component.componentWillUnmount = undefined;
        const parentVNode_ = parentVNode;
        delayedUnmounts.push(() => {
          try {
            component.componentWillUnmount = unmount;
            component.componentWillUnmount();
          } catch (e) {
            options[CATCH_ERROR](e, parentVNode_);
          }
        });
      }
    }
  };
}

export { initDelayUnmount, runDelayedUnmounts, takeDelayedUnmounts };
