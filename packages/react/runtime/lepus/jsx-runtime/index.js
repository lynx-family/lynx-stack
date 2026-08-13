// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { CHILDREN, COMPONENT, DIFF, DIRTY, DOM, FLAGS, INDEX, PARENT, SnapshotInstance } from '@lynx-js/react/internal';

// Kept in sync with `REACT_ELEMENT_TYPE` in preact/compat, whose `isValidElement`
// compares against it. Inlined rather than imported so the main thread does not
// have to pull in compat.
const REACT_ELEMENT_TYPE = Symbol.for('react.element');

// A SnapshotInstance is the main thread's element, so it has to satisfy
// `isValidElement` too. Assigning per instance would add a property after the
// constructor has run, which costs a shape transition on a hot path, so put it
// on the prototype instead. Writable, so that the `$$typeof: undefined` in
// `renderToOpcodes` can still shadow it.
Object.defineProperty(SnapshotInstance.prototype, '$$typeof', {
  value: REACT_ELEMENT_TYPE,
  writable: true,
  configurable: true,
});

function createVNode(type, props, _key) {
  if (typeof type === 'string') {
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
      $$typeof: REACT_ELEMENT_TYPE,
    };
  }
}

export { createVNode as jsx, createVNode as jsxs, createVNode as jsxDEV };
export { Fragment } from 'preact';
