// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// @ts-nocheck

import type { VNode } from 'preact';

import { SnapshotInstance } from '../snapshot.js';

export function createVNode(type: string | any, props: any): VNode {
  if (typeof type === 'string') {
    const r = {};

    r.props = props;
    r.ref = props['mtc:ref'];

    r.__k = null;
    r.__ = null;
    r.__b = 0;
    r.__e = new SnapshotInstance(type);
    r.__d = undefined;
    r.__c = null;
    // r.__v = --vnodeId;
    r.__i = -1;
    r.__u = 0;

    return r;
  } else if (typeof type === 'function') {
    let normalizedProps = props;

    // let ref;
    if ('ref' in normalizedProps) {
      normalizedProps = {};
      for (const i in props) {
        if (i == 'ref') {
          // ref = props[i];
        } else {
          normalizedProps[i] = props[i];
        }
      }
    }

    let defaultProps;
    if ((defaultProps = type.defaultProps)) {
      for (const i in defaultProps) {
        if (typeof normalizedProps[i] === 'undefined') {
          normalizedProps[i] = defaultProps[i];
        }
      }
    }

    return {
      type,
      props: normalizedProps,

      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: void 0,
      __c: null,
      constructor: void 0,
      // __v: --vnodeId,
      __i: -1,
      __u: 0,
    };
  }
}
