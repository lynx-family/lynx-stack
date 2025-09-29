// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { VNode } from 'preact';
import { createElement as createElementBackground } from 'preact/compat';

import { createElement as createElementMainThread } from '@lynx-js/react/lepus';

import { createElementVNode } from './createVNode.js';
import type { BackgroundSnapshotInstance } from '../backgroundSnapshot.js';
// import { printSnapshotInstance } from '../debug/printSnapshot.js';
import { snapshotInstanceManager } from '../snapshot.js';
import type { SnapshotInstance } from '../snapshot.js';

export function renderMTCSlot(btc: { $$typeof: string; i: number }): unknown {
  if (!btc || btc.$$typeof !== '__MTC_SLOT__') {
    return btc;
  }
  const vnode = createElementVNode('wrapper', {
    'mtc:ref': (si: SnapshotInstance) => {
      if (si) {
        // TODO: refactor this
        void Promise.resolve().then(() => {
          // console.log('snapshotInstanceManager.values', [...snapshotInstanceManager.values.keys()]);
          const child = snapshotInstanceManager.values.get(btc.i)!;
          // console.log('zzzz insertBefore in renderMTCSlot', si.__id, btc.i);
          if (child.parentNode && child.parentNode !== si) {
            child.parentNode.parentNode?.removeChild(child.parentNode, { keepSubTree: true });
            // child.parentNode.removeChild(child);
          }
          si.insertBefore(child);
        }).then(() => {
          // console.debug('********** Lepus renderMTCSlot:');
          // printSnapshotInstance(snapshotInstanceManager.values.get(-1)!);
          // console.log('__FlushElementTree in renderMTCSlot');
          __FlushElementTree();
        });
      }
    },
  });
  return vnode;
}

export function renderFakeMTCSlot(jsxs: [VNode, { i: number }][]): VNode[] {
  return jsxs.map(([jsx, placeholder]) => {
    if (__MAIN_THREAD__) {
      return (createElementMainThread('ignore', {
        'mtc:ref': (si: SnapshotInstance) => {
          if (si) {
            // console.log('mtc:ref in renderFakeMTCSlot', si);
            placeholder.i = si.childNodes[0]!.__id;
          }
        },
      }, jsx as any)) as any;
    } else {
      return (
        // @ts-expect-error ignore is a valid element type
        createElementBackground('ignore', {
          ref: (bsi: BackgroundSnapshotInstance) => {
            if (bsi) {
              // placeholder.i = bsi.childNodes[0]!.__id;
              // @ts-ignore
              placeholder.bsi = bsi;
              // @ts-ignore
              placeholder.toJSON = function(this: SnapshotInstance) {
                return {
                  ...placeholder,
                  bsi: undefined,
                  i: bsi.childNodes[0]!.__id,
                };
              };
            }
          },
        }, jsx)
      );
    }
  });
}
