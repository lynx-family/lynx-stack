// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Attributes, VNode } from 'preact';

import { SnapshotInstance } from '../snapshot.js';

let vnodeId = -100000;

export function createElementVNode(
  type: string,
  props: Attributes & { 'mtc:ref'?: (si: SnapshotInstance) => void },
): VNode {
  const r = {
    props: props,
    ref: props['mtc:ref'],
    type: type,
    constructor: undefined,

    __k: null,
    __: null,
    __b: 0,
    __e: new SnapshotInstance(type),
    __d: undefined,
    __c: null,
    __i: -1,
    __u: 0,
    __v: --vnodeId,
  };

  return r as unknown as VNode;
}
