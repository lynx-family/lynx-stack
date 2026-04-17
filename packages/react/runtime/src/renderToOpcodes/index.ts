// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements rendering to opcodes.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * opcodes instead of HTML strings for Lynx.
 */

// @ts-nocheck

import { Fragment, flattenNamedChildren, h, options, isValidElement } from 'preact';
import { SnapshotInstance } from '../snapshot/snapshot.js';

import {
  CHILDREN,
  COMMIT,
  COMPONENT,
  DIFF,
  DIFF2,
  DIFFED,
  DIRTY,
  NEXT_STATE,
  PARENT,
  RENDER,
  SKIP_EFFECTS,
  VNODE,
  HOOK,
  CHILD_DID_SUSPEND,
} from './constants.js';

/** @typedef {import('preact').VNode} VNode */

const EMPTY_ARR = [];
const isArray = /* @__PURE__ */ Array.isArray;
const assign = /* @__PURE__ */ Object.assign;

// Global state for the current render pass
let beforeDiff, beforeDiff2, afterDiff, renderHook, ummountHook;

/**
 * Render Preact JSX + Components to an HTML string.
 * @param {VNode} vnode	JSX Element / VNode to render
 * @param {object} [context] Initial root context object
 */
export function renderToString(vnode: any, context: any, into: SnapshotInstance): any[] {
  // Performance optimization: `renderToString` is synchronous and we
  // therefore don't execute any effects. To do that we pass an empty
  // array to `options._commit` (`__c`). But we can go one step further
  // and avoid a lot of dirty checks and allocations by setting
  // `options._skipEffects` (`__s`) too.
  const previousSkipEffects = options[SKIP_EFFECTS];
  options[SKIP_EFFECTS] = true;

  // store options hooks once before each synchronous render call
  beforeDiff = options[DIFF];
  beforeDiff2 = options[DIFF2];
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
      0,
      undefined,
      parent,
      opcodes,
      0,
      into,
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
  this[DIRTY] = true;
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
  const type = /** @type {import("preact").ComponentClass<typeof vnode.props>} */ (vnode.type);

  let c;
  if (vnode[COMPONENT]) {
    c = vnode[COMPONENT];
    c.state = c[NEXT_STATE];
  } else {
    c = new type(vnode.props, context);
  }

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
 * @param {number | true} slotIndex
 * @param {any} selectValue
 * @param {VNode} parent
 * @param {any[]} opcodes
 * @param {number} opcodesLength
 * @param {SnapshotInstance} into
 */
function _renderToString(
  vnode,
  context,
  slotIndex,
  selectValue,
  parent,
  opcodes,
  opcodesLength,
  into,
) {
  // Ignore non-rendered VNodes/values
  if (vnode == null || vnode === true || vnode === false || vnode === '') {
    return;
  }

  let vnodeType = typeof vnode;
  // Text VNodes: escape as HTML
  if (vnodeType !== 'object') {
    if (vnodeType === 'function') return;
    renderToTextNode(into, vnode, opcodes, slotIndex);
    return;
  }

  // Recurse into children / Arrays
  if (isArray(vnode)) {
    parent[CHILDREN] = vnode;
    for (let i = 0; i < vnode.length; i++) {
      const child = vnode[i];
      if (child == null || typeof child === 'boolean') continue;

      _renderToString(
        child,
        context,
        // When the parent was a multi-slot element, `slotIndex` is the
        // per-child `slotMap` built in `flattenNamedChildren`; otherwise
        // it's a single number inherited unchanged.
        isArray(slotIndex) ? slotIndex[i] : slotIndex,
        selectValue,
        parent,
        opcodes,
        /* v8 ignore start */
        __ENABLE_SSR__ ? opcodes.length : 0,
        /* v8 ignore end */
        into,
      );
    }
    return;
  }

  // VNodes have {constructor:undefined} to prevent JSON injection:
  // if (vnode.constructor !== undefined) return;

  vnode[PARENT] = parent;
  if (beforeDiff) beforeDiff(vnode);
  if (beforeDiff2) beforeDiff2(vnode, EMPTY_OBJ);

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
        const provider = context[contextType.__c];
        cctx = provider ? provider.props.value : contextType.__;
      }

      if (type.prototype && typeof type.prototype.render === 'function') {
        rendered = /**#__NOINLINE__**/ renderClassComponent(vnode, cctx);
        component = vnode[COMPONENT];
      } else {
        component = {
          [VNODE]: vnode,
          props,
          context: cctx,
          // silently drop state updates
          setState: markAsDirty,
          forceUpdate: markAsDirty,
          [DIRTY]: true,
          // hooks
          [HOOK]: [],
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
    const isTopLevelFragment = rendered != null && rendered.type === Fragment
      && rendered.key == null;
    rendered = isTopLevelFragment ? rendered.props.children : rendered;

    let lastChild = into.__lastChild;
    // Recurse into children before invoking the after-diff hook
    try {
      _renderToString(
        rendered,
        context,
        slotIndex,
        selectValue,
        vnode,
        opcodes,
        /* v8 ignore start */
        __ENABLE_SSR__ ? opcodes.length : 0,
        /* v8 ignore end */
        into,
      );
    } catch (e) {
      // clear existing children
      into.removeChildren(
        lastChild
          ? lastChild.__nextSibling
          : into.__firstChild,
      );
      if (e && typeof e === 'object' && e.then && component && /* _childDidSuspend */ component[CHILD_DID_SUSPEND]) {
        component[NEXT_STATE] = assign({}, component[NEXT_STATE], {
          /* _suspended */ __a: true,
        });
        if (component[DIRTY]) {
          rendered = renderClassComponent(vnode, context);
          component = vnode[COMPONENT];

          if (__ENABLE_SSR__) {
            opcodes.length = opcodesLength;
          }
          _renderToString(
            rendered,
            context,
            slotIndex,
            selectValue,
            vnode,
            opcodes,
            /* v8 ignore start */
            __ENABLE_SSR__ ? opcodes.length : 0,
            /* v8 ignore end */
            into,
          );
        }
      } else {
        throw e;
      }
    } finally {
      if (afterDiff) afterDiff(vnode);
      vnode[PARENT] = undefined;

      if (ummountHook) ummountHook(vnode);
    }

    return;
  }

  let children;
  let hasNamedChildren = false;

  // hack for runtime test
  if (process.env['NODE_ENV'] === 'test' && isValidElement(vnode) && typeof vnode.type === 'string') {
    vnode = Object.assign(new SnapshotInstance(type), vnode, { $$typeof: undefined });
  }
  // already inserted
  if (vnode.__parent) {
    vnode = new SnapshotInstance(type);
  }
  if (__ENABLE_SSR__) {
    opcodes.push(__OpBegin, vnode, slotIndex);
  }
  vnode.__slotIndex = slotIndex;
  into.insertBefore(vnode);

  for (const name in props) {
    const v = props[name];

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

      default: {
        if (name.startsWith('$')) {
          children ??= [];
          children[+name.slice(1)] = v;
          hasNamedChildren = true;
          continue;
        }
      }
    }

    // write this attribute to the buffer
    if (v != null && v !== false && typeof v !== 'function') {
      if (__ENABLE_SSR__) {
        opcodes.push(__OpAttr, name, v);
      }
      vnode.setAttribute(name, v);
    }
  }

  let childrenType = typeof children;
  if (childrenType === 'string' || childrenType === 'number') {
    // single text child
    renderToTextNode(vnode, children, opcodes, slotIndex);
  } else if (children != null && children !== false && children !== true) {
    // recurse into this element VNode's children
    let _slotIndex = slotIndex;
    if (hasNamedChildren) {
      // Same shape as the `diffElementNodes` multi-slot path in preact:
      // flatten `$N` values (including arrays inside a single slot) and
      // pass a per-child `slotMap` via `_slotIndex` so each flattened
      // child's eventual `__slotIndex` lines up with its original slot.
      // @ts-expect-error children is an array of slot values
      const { flat, slotMap } = flattenNamedChildren(children);
      children = flat;
      _slotIndex = slotMap;
    }
    _renderToString(
      children,
      context,
      _slotIndex,
      selectValue,
      vnode,
      opcodes,
      /* v8 ignore start */
      __ENABLE_SSR__ ? opcodes.length : 0,
      /* v8 ignore end */
      vnode,
    );
  }

  if (afterDiff) afterDiff(vnode);
  vnode[PARENT] = undefined;
  if (ummountHook) ummountHook(vnode);

  if (__ENABLE_SSR__) {
    opcodes.push(__OpEnd);
  }
  vnode[CHILDREN] = undefined;

  return;
}

/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
  return this.constructor(props, context);
}

function renderToTextNode(into: SnapshotInstance, text: string | number, opcodes: Opcode[], slotIndex: number) {
  const textNode = new SnapshotInstance(null);
  textNode.__slotIndex = slotIndex;
  textNode.setAttribute(0, text);
  into.insertBefore(textNode);
  if (__ENABLE_SSR__) {
    // We need store the just created SnapshotInstance, or it will be lost when we leave the function
    text = [textNode, text];
    opcodes.push(__OpText, text, slotIndex);
  }
}

export default renderToString;
export const render: typeof renderToString = renderToString;
export const renderToStaticMarkup: typeof renderToString = renderToString;
