import { options } from 'preact';
import type { VNode } from 'preact';
import { COMPONENT, DIFF, DIFFED, FORCE } from '../renderToOpcodes/constants.js';

const sForcedVNode = Symbol('FORCE');

type PatchedVNode = VNode & { [sForcedVNode]?: true };

export function runWithForce(cb: () => void): void {
  // save vnode and its `_component` in WeakMap
  const m = new WeakMap<VNode, any>();

  const oldDiff = options[DIFF];

  options[DIFF] = (vnode: PatchedVNode) => {
    if (oldDiff) {
      oldDiff(vnode);
    }

    // when `options[DIFF]` is called, a newVnode is passed in
    // so its `vnode[COMPONENT]` should be null,
    // but it will be set later
    Object.defineProperty(vnode, COMPONENT, {
      configurable: true,
      set(c) {
        m.set(vnode, c);
        if (c) {
          c[FORCE] = true;
        }
      },
      get() {
        return m.get(vnode);
      },
    });
    vnode[sForcedVNode] = true;
  };

  const oldDiffed = options[DIFFED];

  options[DIFFED] = (vnode: PatchedVNode) => {
    if (oldDiffed) {
      oldDiffed(vnode);
    }

    // There would be cases when `options[DIFF]` has been reset while options[DIFFED] is not,
    // so we need to check if `vnode` is patched by `options[DIFF]`.
    // We only want to change the patched vnode
    if (vnode[sForcedVNode]) {
      // delete is a reverse operation of previous `Object.defineProperty`
      delete vnode[COMPONENT];
      delete vnode[sForcedVNode];
      // restore
      vnode[COMPONENT] = m.get(vnode);
    }
  };

  try {
    cb();
  } finally {
    options[DIFF] = oldDiff as (vnode: VNode) => void;
    options[DIFFED] = oldDiffed as (vnode: VNode) => void;
  }
}
