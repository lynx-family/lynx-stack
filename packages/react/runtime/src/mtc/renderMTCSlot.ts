// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';
import { createElement as createElementBackground } from 'preact/compat';

import { createElementVNode } from './createVNode.js';
import type { BackgroundSnapshotInstance } from '../backgroundSnapshot.js';
import { snapshotInstanceManager } from '../snapshot.js';
import type { SnapshotInstance } from '../snapshot.js';

export function renderMTCSlot(btc: { $$typeof: string; i: number }): unknown {
  if (!btc || btc.$$typeof !== '__MTC_SLOT__') {
    return btc;
  }
  const vnode = createElementVNode('wrapper', {
    'mtc:ref': (si: SnapshotInstance) => {
      if (si) {
        si.insertBefore(snapshotInstanceManager.values.get(btc.i)!);
      }
    },
  });
  return vnode;
}

export function renderFakeMTCSlot(jsxs: [VNode, { i: number }][]): VNode[] {
  return jsxs.map(([jsx, placeholder]) => (
    // @ts-expect-error wrapper is a valid element type
    createElementBackground('wrapper', {
      ref: (bsi: BackgroundSnapshotInstance) => {
        if (bsi) {
          placeholder.i = bsi.childNodes[0]!.__id;
        }
      },
    }, jsx)
  ));
}
