// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { VNode } from 'preact';

import { __root } from '../../root.js';
import { updateMainThread } from '../lifecycle/patch/updateMainThread.js';
import { render } from '../renderToOpcodes/index.js';
import { __page, __pageId, setupPage } from '../snapshot/definition.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';
import { snapshotInstanceManager } from '../snapshot/snapshotInstanceManager.js';

/** Creates the main-thread renderer for a page with independently hosted roots. */
export function createMainThreadRenderer() {
  return {
    /** Initializes the shared page before creating its roots. */
    initialize(initialData: Record<string, unknown>): { element: FiberElement; id: number } {
      lynx.__initData = initialData;
      setupPage(__CreatePage('0', 0));
      (__root as SnapshotInstance).ensureElements();
      __FlushElementTree(__page, {});
      return { element: __page, id: __pageId };
    },
    /** Creates a first-frame root inside a caller-owned native element. */
    createRoot(element: FiberElement) {
      const root = new SnapshotInstance('root');
      root.__elements = [element];
      root.__element_root = element;
      return {
        /** Renders the first frame and serializes it for background hydration. */
        render(vnode: VNode): string {
          render(vnode, undefined, root);
          return JSON.stringify(root);
        },
        /** Releases the snapshot tree while leaving ownership of its host to the caller. */
        destroy(): void {
          const ids: number[] = [];
          const visit = (node: SnapshotInstance) => {
            ids.push(node.__id);
            node.childNodes.forEach(child => visit(child));
          };
          visit(root);
          root.removeChildren();
          ids.forEach(id => snapshotInstanceManager.values.delete(id));
        },
      };
    },
    /** Applies a serialized renderer commit from the background thread. */
    applyCommit(commit: Parameters<typeof updateMainThread>[0]): void {
      updateMainThread(commit);
    },
  };
}
