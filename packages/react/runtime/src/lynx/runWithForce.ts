import { options } from 'preact';
import type { VNode } from 'preact';
import { COMPONENT, DIFF, DIFFED, FORCE } from '../renderToOpcodes/constants.js';

export function runWithForce(cb: () => void): void {
  // save vnode and its `_component` in WeakMap
  const m = new WeakMap<VNode, any>();

  const oldDiff = options[DIFF];

  options[DIFF] = (vnode: VNode) => {
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
  };

  const oldDiffed = options[DIFFED];

  options[DIFFED] = (vnode: VNode) => {
    if (oldDiffed) {
      oldDiffed(vnode);
    }

    // delete is a reverse operation of previous `Object.defineProperty`
    delete vnode[COMPONENT];
    // restore
    vnode[COMPONENT] = m.get(vnode);
  };

  try {
    cb();
  } finally {
    options[DIFF] = oldDiff as (vnode: VNode) => void;
    options[DIFFED] = oldDiffed as (vnode: VNode) => void;
  }
}
