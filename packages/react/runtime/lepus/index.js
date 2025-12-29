// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { jsx as createVNode } from './jsx-runtime/index.js';

const slice = /* @__PURE__ */ [].slice;

/**
 * Create an virtual node (used for JSX)
 * @param {VNode["type"]} type The node name or Component constructor for this
 * virtual node
 * @param {object | null | undefined} [props] The properties of the virtual node
 * @param {Array<import('.').ComponentChildren>} [children] The children of the
 * virtual node
 * @returns {VNode}
 */
export function createElement(type, props, children) {
  let normalizedProps = {},
    key,
    ref,
    i;
  for (i in props) {
    if (i == 'key') key = props[i];
    else if (i == 'ref') ref = props[i];
    else normalizedProps[i] = props[i];
  }

  if (arguments.length > 2) {
    normalizedProps.children = arguments.length > 3 ? slice.call(arguments, 2) : children;
  }

  // If a Component VNode, check for and apply defaultProps
  // Note: type may be undefined in development, must never error here.
  if (typeof type == 'function' && type.defaultProps != null) {
    for (i in type.defaultProps) {
      if (normalizedProps[i] === undefined) {
        normalizedProps[i] = type.defaultProps[i];
      }
    }
  }

  return createVNode(type, normalizedProps, key, ref, null);
}

/**
 * Clones the given VNode, optionally adding attributes/props and replacing its
 * children.
 * @param {VNode} vnode The virtual DOM element to clone
 * @param {object} props Attributes/props to add when cloning
 * @param {Array<ComponentChildren>} rest Any additional arguments will be used
 * as replacement children.
 * @returns {VNode}
 */
export function cloneElement(vnode, props, children) {
  let normalizedProps = Object.assign({}, vnode.props),
    key,
    ref,
    i;

  let defaultProps;

  if (vnode.type && vnode.type.defaultProps) {
    defaultProps = vnode.type.defaultProps;
  }

  for (i in props) {
    if (i == 'key') key = props[i];
    else if (i == 'ref') ref = props[i];
    else if (props[i] === undefined && defaultProps !== undefined) {
      normalizedProps[i] = defaultProps[i];
    } else {
      normalizedProps[i] = props[i];
    }
  }

  if (arguments.length > 2) {
    normalizedProps.children = arguments.length > 3 ? slice.call(arguments, 2) : children;
  }

  return createVNode(
    vnode.type,
    normalizedProps,
    key || vnode.key,
    ref || vnode.ref,
    null,
  );
}
