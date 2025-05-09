// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements rendering to opcodes.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * opcodes instead of HTML strings for Lynx.
 */

// @ts-nocheck

import { Fragment, h, options } from 'preact';

import {
  CHILDREN,
  COMMIT,
  COMPONENT,
  DIFF,
  DIFFED,
  DIRTY,
  NEXT_STATE,
  PARENT,
  RENDER,
  SKIP_EFFECTS,
  VNODE,
} from './constants.js';

/** @typedef {import('preact').VNode} VNode */

const EMPTY_ARR = [];
const isArray = /* @__PURE__ */ Array.isArray;
const assign = /* @__PURE__ */ Object.assign;

// Global state for the current render pass
let beforeDiff, afterDiff, renderHook, ummountHook;

/**
 * Render Preact JSX + Components to an HTML string.
 * @param {VNode} vnode	JSX Element / VNode to render
 * @param {object} [context] Initial root context object
 */
export function renderToString(vnode: any, context: any): any[] {
  // Performance optimization: `renderToString` is synchronous and we
  // therefore don't execute any effects. To do that we pass an empty
  // array to `options._commit` (`__c`). But we can go one step further
  // and avoid a lot of dirty checks and allocations by setting
  // `options._skipEffects` (`__s`) too.
  const previousSkipEffects = options[SKIP_EFFECTS];
  options[SKIP_EFFECTS] = true;

  // store options hooks once before each synchronous render call
  beforeDiff = options[DIFF];
  afterDiff = options[DIFFED];
  renderHook = options[RENDER];
  ummountHook = options.unmount;

  const parent = h(Fragment, null);
  parent[CHILDREN] = [vnode];

  const opcodes = [];

  try {
    _renderToString(
      vnode,
      context || EMPTY_OBJ,
      false,
      undefined,
      parent,
      opcodes,
    );
  } finally {
    // options._commit, we don't schedule any effects in this library right now,
    // so we can pass an empty queue to this hook.
    if (options[COMMIT]) options[COMMIT](vnode, EMPTY_ARR);
    options[SKIP_EFFECTS] = previousSkipEffects;
    EMPTY_ARR.length = 0;
  }

  return opcodes;
}

// Installed as setState/forceUpdate for function components
function markAsDirty() {
  this.__d = true;
}

const EMPTY_OBJ = {};

export const __OpBegin = 0;
export const __OpEnd = 1;
export const __OpAttr = 2;
export const __OpText = 3;

/**
 * @param {VNode} vnode
 * @param {Record<string, unknown>} context
 */
function renderClassComponent(vnode, context) {
  let type = /** @type {import("preact").ComponentClass<typeof vnode.props>} */ (vnode.type);

  let c = new type(vnode.props, context);

  vnode[COMPONENT] = c;
  c[VNODE] = vnode;

  c.props = vnode.props;
  c.context = context;
  // turn off stateful re-rendering:
  c[DIRTY] = true;

  if (c.state == null) c.state = EMPTY_OBJ;

  if (c[NEXT_STATE] == null) {
    c[NEXT_STATE] = c.state;
  }

  if (type.getDerivedStateFromProps) {
    c.state = assign(
      {},
      c.state,
      type.getDerivedStateFromProps(c.props, c.state),
    );
  }

  if (renderHook) renderHook(vnode);

  return c.render(c.props, c.state, context);
}

/**
 * Recursively render VNodes to HTML.
 * @param {VNode|any} vnode
 * @param {any} context
 * @param {boolean} isSvgMode
 * @param {any} selectValue
 * @param {VNode} parent
 * @param opcodes
 */
function _renderToString(
  vnode,
  context,
  isSvgMode,
  selectValue,
  parent,
  opcodes,
) {
  // Ignore non-rendered VNodes/values
  if (vnode == null || vnode === true || vnode === false || vnode === '') {
    return;
  }

  // Text VNodes: escape as HTML
  if (typeof vnode !== 'object') {
    if (typeof vnode === 'function') return;

    opcodes.push(__OpText, vnode + '');
    return;
  }

  // Recurse into children / Arrays
  if (isArray(vnode)) {
    parent[CHILDREN] = vnode;
    for (let i = 0; i < vnode.length; i++) {
      let child = vnode[i];
      if (child == null || typeof child === 'boolean') continue;

      _renderToString(child, context, isSvgMode, selectValue, parent, opcodes);
    }
    return;
  }

  // VNodes have {constructor:undefined} to prevent JSON injection:
  // if (vnode.constructor !== undefined) return;

  vnode[PARENT] = parent;
  if (beforeDiff) beforeDiff(vnode);

  let type = vnode.type,
    props = vnode.props,
    cctx = context,
    contextType,
    rendered,
    component;

  // Invoke rendering on Components
  if (typeof type === 'function') {
    if (type === Fragment) {
      rendered = props.children;
    } else {
      contextType = type.contextType;
      if (contextType != null) {
        let provider = context[contextType.__c];
        cctx = provider ? provider.props.value : contextType.__;
      }

      if (type.prototype && typeof type.prototype.render === 'function') {
        rendered = /**#__NOINLINE__**/ renderClassComponent(vnode, cctx);
        component = vnode[COMPONENT];
      } else {
        component = {
          __v: vnode,
          props,
          context: cctx,
          // silently drop state updates
          setState: markAsDirty,
          forceUpdate: markAsDirty,
          __d: true,
          // hooks
          __h: [],
        };
        vnode[COMPONENT] = component;
        component.constructor = type;
        component.render = doRender;

        // If a hook invokes setState() to invalidate the component during rendering,
        // re-render it up to 25 times to allow "settling" of memoized states.
        // Note:
        //   This will need to be updated for Preact 11 to use internal.flags rather than component._dirty:
        //   https://github.com/preactjs/preact/blob/d4ca6fdb19bc715e49fd144e69f7296b2f4daa40/src/diff/component.js#L35-L44
        let count = 0;
        while (component[DIRTY] && count++ < 25) {
          component[DIRTY] = false;

          if (renderHook) renderHook(vnode);

          rendered = component.render(props, component.state, cctx);
        }
        component[DIRTY] = true;
      }

      if (component.getChildContext != null) {
        context = assign({}, context, component.getChildContext());
      }
    }

    // When a component returns a Fragment node we flatten it in core, so we
    // need to mirror that logic here too
    let isTopLevelFragment = rendered != null && rendered.type === Fragment
      && rendered.key == null;
    rendered = isTopLevelFragment ? rendered.props.children : rendered;

    // Recurse into children before invoking the after-diff hook
    _renderToString(rendered, context, isSvgMode, selectValue, vnode, opcodes);
    if (afterDiff) afterDiff(vnode);
    vnode[PARENT] = undefined;

    if (ummountHook) ummountHook(vnode);

    return;
  }

  let children;

  opcodes.push(__OpBegin, vnode);

  for (let name in props) {
    let v = props[name];

    switch (name) {
      case 'children':
        children = v;
        continue;

      // VDOM-specific props
      /* c8 ignore next 5 */
      case 'key':
      case 'ref':
      case '__self':
      case '__source':
        continue;

      default: {}
    }

    // write this attribute to the buffer
    if (v != null && v !== false && typeof v !== 'function') {
      opcodes.push(__OpAttr, name, v);
    }
  }

  if (typeof children === 'string') {
    // single text child
    opcodes.push(__OpText, children);
  } else if (children != null && children !== false && children !== true) {
    // recurse into this element VNode's children
    _renderToString(children, context, false, selectValue, vnode, opcodes);
  }

  if (afterDiff) afterDiff(vnode);
  vnode[PARENT] = undefined;
  if (ummountHook) ummountHook(vnode);

  opcodes.push(__OpEnd);

  return;
}

/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
  return this.constructor(props, context);
}

export default renderToString;
export const render: typeof renderToString = renderToString;
export const renderToStaticMarkup: typeof renderToString = renderToString;
