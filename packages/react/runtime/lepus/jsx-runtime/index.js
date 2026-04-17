// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { CHILDREN, COMPONENT, DIFF, DIRTY, DOM, FLAGS, INDEX, PARENT, SnapshotInstance } from '@lynx-js/react/internal';

function createVNode(type, props, _key) {
  if (typeof type === 'string') {
    if (__USE_ELEMENT_TEMPLATE__) {
      const normalizedProps = props || {};
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
    const r = new SnapshotInstance(type);

    r.props = props;

    r[CHILDREN] = null;
    r[PARENT] = null;
    r[DIFF] = 0;
    r[DOM] = null;
    r[DIRTY] = undefined;
    r[COMPONENT] = null;
    // r.__v = --vnodeId;
    r[INDEX] = -1;
    r[FLAGS] = 0;

    return r;
  } else if (typeof type === 'function') {
    let normalizedProps = props;

    // let ref;
    if ('ref' in normalizedProps) {
      normalizedProps = {};
      for (let i in props) {
        if (i == 'ref') {
          // ref = props[i];
        } else {
          normalizedProps[i] = props[i];
        }
      }
    }

    let defaultProps;
    if ((defaultProps = type.defaultProps)) {
      for (let i in defaultProps) {
        if (typeof normalizedProps[i] === 'undefined') {
          normalizedProps[i] = defaultProps[i];
        }
      }
    }

    return {
      type,
      props: normalizedProps,

      [CHILDREN]: null,
      [PARENT]: null,
      [DIFF]: 0,
      [DOM]: null,
      [DIRTY]: void 0,
      [COMPONENT]: null,
      constructor: void 0,
      // __v: --vnodeId,
      [INDEX]: -1,
      [FLAGS]: 0,
    };
  }
}

export { createVNode as jsx, createVNode as jsxs, createVNode as jsxDEV };
export { Fragment } from 'preact';
