// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { CHILDREN, COMPONENT, DIFF, DIRTY, DOM, FLAGS, INDEX, PARENT } from '../../renderToOpcodes/constants.js';

type ComponentLike = ((...args: unknown[]) => unknown) & {
  defaultProps?: Record<string, unknown>;
};

interface ElementTemplateVNode {
  type: string | ComponentLike;
  props: Record<string, unknown> | null | undefined;
  __k: null;
  __: null;
  __b: number;
  __e: null;
  __d: undefined;
  __c: null;
  constructor: undefined;
  __i: number;
  __u: number;
}

function createVNode(
  type: string | ComponentLike | null | undefined,
  props: Record<string, unknown> | null | undefined,
): ElementTemplateVNode | undefined {
  if (typeof type === 'string') {
    // ET host nodes are consumed by the opcode renderer directly, so they
    // should not go through the SnapshotInstance construction path.
    return {
      type,
      props: props ?? {},

      [CHILDREN]: null,
      [PARENT]: null,
      [DIFF]: 0,
      [DOM]: null,
      [DIRTY]: void 0,
      [COMPONENT]: null,
      constructor: void 0,
      [INDEX]: -1,
      [FLAGS]: 0,
    };
  } else if (typeof type === 'function') {
    let normalizedProps = props;

    if (normalizedProps && 'ref' in normalizedProps) {
      normalizedProps = {};
      for (const i in props) {
        if (i !== 'ref') {
          normalizedProps[i] = props[i];
        }
      }
    }

    let defaultProps;
    if ((defaultProps = type.defaultProps)) {
      normalizedProps ??= {};
      for (const i in defaultProps) {
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
      [INDEX]: -1,
      [FLAGS]: 0,
    };
  }

  return undefined;
}

export { createVNode as jsx, createVNode as jsxs, createVNode as jsxDEV };
export { Fragment } from 'preact';
