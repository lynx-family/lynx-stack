// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Attributes, ComponentChildren, VNode } from 'preact';
import { cloneElement as preactCloneElement } from 'preact/compat';

import { cloneElement as mainThreadCloneElement } from '../lepus/index.js';

export const cloneElement: typeof import('preact/compat').cloneElement = /*#__PURE__*/ (() => {
  if (process.env['NODE_ENV'] === 'test') {
    return function<P>(vnode: VNode, props?: Attributes & P, ...children: ComponentChildren[]) {
      children ??= [];
      if (__BACKGROUND__) {
        return preactCloneElement(vnode, props, ...children);
      } else {
        return mainThreadCloneElement(vnode, props, ...children);
      }
    } as typeof import('preact/compat').cloneElement;
    /* v8 ignore start */
  }

  if (__BACKGROUND__) {
    return preactCloneElement;
  } else {
    return mainThreadCloneElement;
  }
  /* v8 ignore stop */
})();
