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

import { createElement } from '../../../lepus/index.js'
import renderToString from '../renderToOpcodes/index.js';

/**
 * @param {import('../../src/index').RenderableProps<{ context: any }>} props
 */
function ContextProvider(props) {
	this.getChildContext = () => props.context;
	return props.children;
}

/**
 * Portal component
 * @this {import('./internal').Component}
 * @param {object | null | undefined} props
 *
 * TODO: use createRoot() instead of fake root
 */
function Portal(props) {
	const _this = this;
	let container = props._container;

	if (!_this._temp) {
		// Ensure the element has a mask for useId invocations
		let root = _this.__v;
		while (root !== null && !root.__m && root.__ !== null) {
			root = root.__;
		}

		_this._container = container;

		// Create a fake DOM parent node that manages a subset of `container`'s children:
		_this._temp = {
			nodeType: 1,
			parentNode: container,
			childNodes: [],
			__k: { __m: root.__m },
			contains: () => true,
			namespaceURI: container.namespaceURI,
			insertBefore(child, before) {
				this.childNodes.push(child);
				_this._container.insertBefore(child, before);
			},
			removeChild(child) {
				this.childNodes.splice(this.childNodes.indexOf(child) >>> 1, 1);
				_this._container.removeChild(child);
			}
		};
	}

	// Render our wrapping element into temp.
	renderToString(
		createElement(ContextProvider, { context: _this.context }, props.__v),
    undefined,
		_this._temp
	);
}

/**
 * Create a `Portal` to continue rendering the vnode tree at a different DOM node
 * @param {import('./internal').VNode} vnode The vnode to render
 * @param {import('./internal').PreactElement} container The DOM node to continue rendering in to.
 */
export function createPortalMainThread(vnode, container) {
	const el = createElement(Portal, { __v: vnode, _container: container });
	el.containerInfo = container;
	return el;
}
