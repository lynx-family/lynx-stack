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
      const displayName = getDisplayName(vnode.type as ComponentClass);
      // log the component render into Alog
      console.alog?.(
        `[${__MAIN_THREAD__ ? 'MainThread' : 'BackgroundThread'} Component Render] name: ${displayName}, uniqID: ${
          vnode[DOM]?.type
        }, __id: ${vnode[DOM]?.__id}`,
      );
    }
    oldAfterDiff?.(vnode);
  };
}
