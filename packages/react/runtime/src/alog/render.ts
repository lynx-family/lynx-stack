// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { ComponentClass, VNode } from 'preact';

import { DIFFED, DOM } from '../renderToOpcodes/constants.js';
import type { SnapshotInstance } from '../snapshot.js';
import { getDisplayName } from '../utils.js';

export function initRenderAlog(): void {
  const oldAfterDiff = options[DIFFED];
  options[DIFFED] = function(vnode: VNode & { [DOM]: SnapshotInstance }) {
    // Only log on component vnode
    if (typeof vnode.type === 'function') {
      const threadName = __MAIN_THREAD__ ? 'MainThread' : 'BackgroundThread';
      const displayName = getDisplayName(vnode.type as ComponentClass);
      // log the component render into Alog
      if (__MAIN_THREAD__) {
        console.alog?.(
          `[${threadName} Component Render] name: ${displayName}`,
        );
      } else if (__BACKGROUND__) {
        const dom = vnode[DOM];
        console.alog?.(
          `[${threadName} Component Render] name: ${displayName}, uniqID: ${dom?.type}, __id: ${dom?.__id}`,
        );
      }
    }
    oldAfterDiff?.(vnode);
  };
}
