// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { SnapshotInstance } from '@lynx-js/react/internal';

let vnodeId = -100000;

function createVNode(type, props, _key) {
  if (typeof type === 'string') {
    const r = new SnapshotInstance(type);

    r.props = props;
    r.ref = props['mtc:ref'];

    r.constructor = undefined;
    r.__k = null;
    r.__ = null;
    r.__b = 0;
    r.__e = null;
    r.__d = undefined;
    r.__c = null;
    r.__v = --vnodeId;
    r.__i = -1;
    r.__u = 0;
    r.$$typeof = Symbol.for('react.element');

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
      constructor: undefined,

      __k: null,
      __: null,
      __b: 0,
      __e: null,
      __d: void 0,
      __c: null,
      constructor: void 0,
      __v: --vnodeId,
      __i: -1,
      __u: 0,
      $$typeof: Symbol.for('react.element'),
    };
  }
}

export { createVNode as jsx, createVNode as jsxs, createVNode as jsxDEV };
export { Fragment } from 'preact';
