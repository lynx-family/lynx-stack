// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChildren, ContainerNode, VNode } from 'preact';
import { createPortal as preactCreatePortal } from 'preact/compat';

import type { NodesRef } from '@lynx-js/types';

import { refProxyToBackgroundSnapshotInstance } from '../snapshot/refProxyBackgroundSnapshotInstance.js';

export const createPortal: (
  vnode: ComponentChildren,
  containerNodesRef: NodesRef,
) => VNode<any> = (vnode, containerNodesRef) => {
  const getter = refProxyToBackgroundSnapshotInstance.get(containerNodesRef);
  if (!getter) {
    throw new Error(
      'createPortal: container must be a ref obtained from a ReactLynx element. '
        + 'Refs from lynx.createSelectorQuery() or third-party sources are not supported.',
    );
  }
  const backgroundSnapshotInstance = getter();

  return preactCreatePortal(
    vnode,
    backgroundSnapshotInstance as unknown as ContainerNode,
  );
};
