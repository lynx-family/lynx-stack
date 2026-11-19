// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

/**
 * The internal ReactLynx's root.
 * {@link @lynx-js/react!Root | root}.
 */
let __root: (SnapshotInstance | BackgroundSnapshotInstance) & {
  __jsx?: React.ReactNode;
  __opcodes?: any[];

  /**
   * Returns the type of node.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeType)
   */
  nodeType?: Element['nodeType'];
};

function setRoot(root: typeof __root): void {
  __root = root;

  // A fake ELEMENT_NODE to make preact/debug happy.
  if (__DEV__ && __root) {
    __root.nodeType = 1;
  }
}

if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  setRoot(new SnapshotInstance('root'));
} else if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
  setRoot(new BackgroundSnapshotInstance('root'));
}

/** Set once a page renders transfer components; `root.render` is then ignored. */
let transferMode = false;

function enableTransferMode(): void {
  transferMode = true;
}

function warnRootRenderOnTransferPage(): void {
  if (__DEV__) {
    console.warn(
      '[ReactLynx] `root.render` is ignored on transfer pages. '
        + 'Render components through `TransferRegistry.registerComponent` instead of mixing both.',
    );
  }
}

export { __root, enableTransferMode, setRoot, transferMode, warnRootRenderOnTransferPage };
