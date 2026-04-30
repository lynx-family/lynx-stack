// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createElement, render } from 'preact';
import type { Component, ComponentChild, ComponentChildren, ContainerNode, RenderableProps, VNode } from 'preact';

import type { NodesRef } from '@lynx-js/types';

import { serializeNodesRef } from './nodesRef.js';
import { pendingInsertBefore } from './portalsPending.js';
import { CHILDREN, MASK, PARENT, VNODE } from '../../shared/render-constants.js';
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from '../snapshot/backgroundSnapshot.js';

export { clearPendingPortalInsertBefore } from './portalsPending.js';

interface PortalProps {
  [VNODE]: ComponentChildren;
  _container: NodesRef;
}

interface PortalThis extends Component<PortalProps> {
  _container?: NodesRef;
  _temp?: ContainerNode;
}

function ContextProvider(
  this: { getChildContext: () => unknown },
  props: RenderableProps<{ context: unknown }>,
): ComponentChildren {
  this.getChildContext = () => props.context;
  return props.children;
}

/**
 * Portal component
 *
 * TODO: use createRoot() instead of fake root
 */
function Portal(this: PortalThis, props: PortalProps): ComponentChildren {
  const _this = this;
  const container = props._container;

  _this.componentWillUnmount = function() {
    render(null, _this._temp!);
    delete _this._temp;
    delete _this._container;
  };

  // When we change container we should clear our old container and
  // indicate a new mount.
  if (_this._container && _this._container !== container) {
    _this.componentWillUnmount();
  }

  if (!_this._temp) {
    // Ensure the element has a mask for useId invocations
    let root: VNode<any> | null | undefined = _this[VNODE];
    while (root !== null && !root![MASK] && root![PARENT] !== null) {
      root = root![PARENT];
    }

    _this._container = container;

    // Create a fake DOM parent node that manages a subset of `container`'s children:
    interface FakeRoot {
      nodeType: number;
      parentNode: NodesRef;
      childNodes: BackgroundSnapshotInstance[];
      [CHILDREN]: { [MASK]: VNode[typeof MASK] };
      insertBefore(this: FakeRoot, child: BackgroundSnapshotInstance, before: BackgroundSnapshotInstance | null): void;
      removeChild(this: FakeRoot, child: BackgroundSnapshotInstance): void;
    }
    const fakeRoot: FakeRoot = {
      nodeType: 1,
      parentNode: container,
      childNodes: [],
      [CHILDREN]: { [MASK]: root![MASK] },
      insertBefore(child, before) {
        // Track the child in our local children list AND wire up the BSI's
        // `__parent` pointer to the fakeRoot, regardless of pre-/post-hydrate
        // state. preact's unmount path (`removeNode` in diff/index.js) walks
        // `child.parentNode.removeChild(child)`, not the parent VNode — so
        // without `__parent` set, preact's later unmount silently no-ops and
        // our `removeChild` here never fires.
        this.childNodes.push(child);
        (child as unknown as { __parent: unknown }).__parent = this;

        if (!__globalSnapshotPatch) {
          // Pre-hydrate: queue for replay in `clearPendingPortalInsertBefore`.
          pendingInsertBefore.push(_this._container, child, before);
          return;
        }

        // Post-hydrate: `_this._container` is always set here (we assigned
        // it just above when creating `fakeRoot`), and the global buffer is
        // initialized — emit directly.
        __globalSnapshotPatch.push(
          SnapshotOperation.nodesRefInsertBefore,
          serializeNodesRef(_this._container!),
          child.__id,
          before?.__id,
        );
      },
      removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        (child as unknown as { __parent: unknown }).__parent = null;

        if (__globalSnapshotPatch) {
          __globalSnapshotPatch.push(
            SnapshotOperation.nodesRefRemoveChild,
            serializeNodesRef(_this._container!),
            child.__id,
          );
          return;
        }

        // Pre-hydrate cancellation: an unmount that fires before hydrate
        // would otherwise be silently dropped (the global patch buffer is
        // `undefined`), and the still-pending `nodesRefInsertBefore` from
        // earlier `insertBefore` would resurrect this child during the
        // queue replay. Drain the matching tuple from the queue.
        for (let i = 0; i < pendingInsertBefore.length; i += 3) {
          if (pendingInsertBefore[i + 1] === child) {
            pendingInsertBefore.splice(i, 3);
            break;
          }
        }
      },
    };
    _this._temp = fakeRoot as unknown as ContainerNode;
  }

  // Render our wrapping element into temp.
  render(
    createElement(
      ContextProvider,
      { context: _this.context },
      props[VNODE],
    ),
    _this._temp,
  );
  return;
}

/**
 * Create a `Portal` to continue rendering the vnode tree at a different DOM node.
 *
 * @public
 */
export function createPortal(
  vnode: ComponentChild,
  container: NodesRef,
): VNode<any> | null {
  // Main-thread bundle never renders Portal — the JSX is run only on the
  // background thread. Bail early so the rest of the module (preact's
  // `render` / `createElement`, the BSI cast, etc.) tree-shakes out of
  // the main-thread chunk.
  if (__MAIN_THREAD__) return null;

  const el = createElement(Portal, {
    [VNODE]: vnode,
    _container: container,
  });
  (el as VNode<any> & { containerInfo?: NodesRef }).containerInfo = container;
  return el;
}
