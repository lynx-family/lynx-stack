// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChildren, ContainerNode, VNode } from 'preact';
import { createPortal as preactCreatePortal } from 'preact/compat';

import type { NodesRef } from '@lynx-js/types';

import { __DynamicPartSlotV2 } from '../../internal.js';
import { refProxyToBackgroundSnapshotInstance } from '../refProxyBackgroundSnapshotInstance.js';
import { BackgroundSnapshotInstance } from '../snapshot/backgroundSnapshot.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';

/**
 * Renders `children` into a target Lynx element instead of into the parent
 * in the JSX tree. The target is either:
 * - a ref obtained from a ReactLynx element marked with the `portal-container`
 *   attribute, or
 * - the framework-internal `__root`, imported from `@lynx-js/react/internal`.
 *
 * @public
 */
export const createPortal: (
  vnode: ComponentChildren,
  containerNodesRef: NodesRef | BackgroundSnapshotInstance | SnapshotInstance,
) => VNode<any> = (vnode, containerNodesRef) => {
  // Fast path: framework-internal snapshot instances (e.g. `__root`) are not
  // minted as `RefProxy`s and do not have the `portal-container` slot shape.
  // They are trusted containers, so skip both the RefProxy lookup and the
  // slot-shape check.
  if (
    containerNodesRef instanceof BackgroundSnapshotInstance
    || containerNodesRef instanceof SnapshotInstance
  ) {
    return preactCreatePortal(vnode, containerNodesRef as unknown as ContainerNode);
  }

  const getter = refProxyToBackgroundSnapshotInstance.get(containerNodesRef);
  if (!getter) {
    throw new Error(
      'createPortal: container must be a ref obtained from a ReactLynx element. '
        + 'Refs from lynx.createSelectorQuery() or third-party sources are not supported.',
    );
  }
  const bsi = getter();

  const s = bsi.__snapshot_def.slot;
  if (!s || s.length !== 1 || s[0]![0] !== __DynamicPartSlotV2 || s[0]![1] !== 0) {
    throw new Error(
      `createPortal container is not valid: snapshot type ${bsi.type} must have a single empty slot at element index 0. `
        + `Mark the container element with the \`portal-container\` attribute, e.g. \`<view portal-container ref={hostRef} />\`.`,
    );
  }

  return preactCreatePortal(
    vnode,
    bsi as unknown as ContainerNode,
  );
};
