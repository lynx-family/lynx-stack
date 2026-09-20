// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Shared synchronous Preact component traversal.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * host output instead of HTML strings for Lynx.
 */

// @ts-nocheck

import { Fragment, h, options } from 'preact';

import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../../protocol/page.js';
import { __ElementTemplatePage } from '../page/authored-page.js';
import { prepareTypedElementAttributes } from '../template/typed-attributes.js';
import { markElementTemplateListDestroyed } from '../list/list.js';

import {
  BITS,
  CHILDREN,
  COMMIT,
  COMPONENT,
  COMPONENT_DIRTY,
  DIFF,
  DIFF2,
  DIFFED,
  GLOBAL_CONTEXT,
  NEXT_STATE,
  PARENT,
  RENDER,
  SKIP_EFFECTS,
  VNODE,
} from '../../../shared/render-constants.js';

/** @typedef {import('preact').VNode} VNode */

const EMPTY_ARR = [];
const assign = /* @__PURE__ */ Object.assign;

// Global state for the current render pass
export let beforeDiff: ((vnode: unknown) => void) | undefined;
export let beforeDiff2: ((vnode: unknown, context: Record<string, unknown>) => void) | undefined;
let afterDiff, renderHook, ummountHook;

export function renderWithHooks(
  vnode: unknown,
  context: unknown,
  output: unknown[],
  renderVNode: Function,
  result?: unknown,
): unknown[] {
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

  try {
    renderVNode(
      vnode,
      context || EMPTY_OBJ,
      parent,
      output,
      result,
    );
  } finally {
    // options._commit, we don't schedule any effects in this library right now,
    // so we can pass an empty queue to this hook.
    if (options[COMMIT]) options[COMMIT](vnode, EMPTY_ARR);
    options[SKIP_EFFECTS] = previousSkipEffects;
    EMPTY_ARR.length = 0;
  }

  return output;
}

// Installed as setState/forceUpdate for function components
/* v8 ignore start */
function markAsDirty() {
  this[BITS] |= COMPONENT_DIRTY;
}
/* v8 ignore stop */

export const EMPTY_OBJ: Record<string, unknown> = {};

/**
 * @param {VNode} vnode
 * @param {Record<string, unknown>} context
 */
function renderClassComponent(vnode, context, globalContext) {
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
  c[GLOBAL_CONTEXT] = globalContext;
  // turn off stateful re-rendering:
  c[BITS] |= COMPONENT_DIRTY;

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

export function cleanupVNode(vnode: unknown): void {
  if (afterDiff) afterDiff(vnode);
  vnode[PARENT] = undefined;
  if (ummountHook) ummountHook(vnode);
}

export function renderComponentVNode(
  vnode: unknown,
  type: unknown,
  props: unknown,
  context: unknown,
  output: unknown[],
  renderVNode: Function,
  result?: unknown,
  parentType?: string,
  subtreeHandles?: unknown[],
  listItemUids?: number[],
): void {
  let cctx = context;
  let rendered;
  let component;
  const outputLength = output.length;

  if (type === Fragment) {
    rendered = props.children;
  } else {
    const contextType = type.contextType;
    if (contextType != null) {
      const provider = context[contextType.__c];
      cctx = provider ? provider.props.value : contextType.__;
    }

    if (type.prototype && typeof type.prototype.render === 'function') {
      rendered = /**#__NOINLINE__**/ renderClassComponent(vnode, cctx, context);
      component = vnode[COMPONENT];
    } else {
      component = {
        __v: vnode,
        props,
        context: cctx,
        [GLOBAL_CONTEXT]: context,
        // silently drop state updates
        setState: markAsDirty,
        forceUpdate: markAsDirty,
        __g: COMPONENT_DIRTY,
        // hooks
        __h: [],
      };
      vnode[COMPONENT] = component;
      component.constructor = type;
      component.render = doRender;

      let count = 0;
      while (component[BITS] & COMPONENT_DIRTY && count++ < 25) {
        component[BITS] &= ~COMPONENT_DIRTY;

        if (renderHook) renderHook(vnode);

        rendered = component.render(props, component.state, cctx);
      }
      component[BITS] |= COMPONENT_DIRTY;
    }

    if (component.getChildContext != null) {
      context = assign({}, context, component.getChildContext());
    }
  }

  const isTopLevelFragment = rendered != null && rendered.type === Fragment
    && rendered.key == null;
  rendered = isTopLevelFragment ? rendered.props.children : rendered;

  // Only a Suspense boundary needs a checkpoint. Native creation is immediate,
  // but abandoned children must not leak into the fallback's commit collectors.
  const checkpoint = result !== undefined && component && component.__c
    ? {
      rootSubtreeHandlesLength: result.rootSubtreeHandles.length,
      subtreeHandlesLength: subtreeHandles?.length,
      listItemUidsLength: listItemUids?.length,
      createdListUidsLength: result.createdListUids.length,
      pageAttributes: result.pageAttributes,
      isInsideAuthoredPage: result.isInsideAuthoredPage,
    }
    : undefined;

  try {
    renderVNode(rendered, context, vnode, output, result, parentType, subtreeHandles, listItemUids);
  } catch (e) {
    if (
      e && typeof e === 'object' && e.then && component && /* _childDidSuspend */ component.__c
    ) {
      component.setState({ /* _suspended */ __a: true });

      if (component[BITS] & COMPONENT_DIRTY) {
        rendered = renderClassComponent(vnode, context, context);
        component = vnode[COMPONENT];

        output.length = outputLength;
        if (checkpoint) {
          result.rootSubtreeHandles.length = checkpoint.rootSubtreeHandlesLength;
          if (subtreeHandles) subtreeHandles.length = checkpoint.subtreeHandlesLength;
          if (listItemUids) listItemUids.length = checkpoint.listItemUidsLength;
          for (let index = checkpoint.createdListUidsLength; index < result.createdListUids.length; index++) {
            markElementTemplateListDestroyed(result.createdListUids[index]);
          }
          result.createdListUids.length = checkpoint.createdListUidsLength;
          result.pageAttributes = checkpoint.pageAttributes;
          if (__DEV__) result.isInsideAuthoredPage = checkpoint.isInsideAuthoredPage;
        }
        renderVNode(rendered, context, vnode, output, result, parentType, subtreeHandles, listItemUids);
      }
    } else {
      throw e;
    }
  } finally {
    cleanupVNode(vnode);
  }
}

/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
  return this.constructor(props, context);
}

const isArray = /* @__PURE__ */ Array.isArray;
const TYPED_LIST_HOST_TYPE = 'list';
const TYPED_LIST_LOGICAL_SLOT_PROP = '$0';

export const __OpBegin = 0;
export const __OpEnd = 1;
export const __OpAttr = 2;
export const __OpText = 3;
export const __OpSlot = 4;
export const __OpPageStart = 5;
export const __OpPageEnd = 6;

export function renderToString(vnode: any, context?: any): any[] {
  return renderWithHooks(vnode, context, [], _renderToString, undefined);
}

function shouldRenderEtChild(child) {
  return child != null && child !== false && child !== true;
}

function isCompiledEtHostType(type) {
  return type.startsWith('_et_')
    || type.includes(':_et_');
}

function renderEtSlotArray(slotChildrenById, context, vnode, opcodes) {
  for (let slotId = 0; slotId < slotChildrenById.length; slotId += 1) {
    const slotChildren = slotChildrenById[slotId];
    if (!shouldRenderEtChild(slotChildren)) {
      continue;
    }
    opcodes.push(__OpSlot, slotId);
    _renderToString(slotChildren, context, vnode, opcodes);
  }
}

function renderCompiledEtHostVNode(vnode, props, context, opcodes) {
  opcodes.push(__OpBegin, vnode);

  const attributeSlots = props.attributeSlots;
  if (attributeSlots !== undefined) {
    opcodes.push(__OpAttr, attributeSlots);
  }

  // LEPUS emits an ordered array; MIXED VNodes retain named slots for Preact.
  let childSlots: unknown[] | undefined = props.slotChildren;
  if (childSlots === undefined) {
    for (const name in props) {
      if (name.startsWith('$')) {
        (childSlots ??= [])[+name.slice(1)] = props[name];
      }
    }
  }
  if (childSlots !== undefined) {
    renderEtSlotArray(childSlots, context, vnode, opcodes);
  }

  cleanupVNode(vnode);
  opcodes.push(__OpEnd);
}

function renderTypedListHostVNode(vnode, props, context, opcodes) {
  opcodes.push(__OpBegin, vnode);

  try {
    if (__DEV__) {
      for (const name in props) {
        if (name.startsWith('$') && name !== TYPED_LIST_LOGICAL_SLOT_PROP) {
          throw new Error('Element Template typed list only supports logical slot $0.');
        }
      }
    }

    const attributes = props.attributes;
    if (attributes !== undefined) {
      opcodes.push(__OpAttr, attributes);
    }

    const listChildren = props[TYPED_LIST_LOGICAL_SLOT_PROP];
    if (shouldRenderEtChild(listChildren)) {
      opcodes.push(__OpSlot, 0);
      _renderToString(listChildren, context, vnode, opcodes);
    }
  } finally {
    cleanupVNode(vnode);
  }

  opcodes.push(__OpEnd);
}

function renderStringHostVNode(type, vnode, props, context, opcodes) {
  if (type === TYPED_LIST_HOST_TYPE) {
    renderTypedListHostVNode(vnode, props, context, opcodes);
    return;
  }

  if (!isCompiledEtHostType(type)) {
    cleanupVNode(vnode);
    throw new Error(
      `Element Template main-thread renderer received an uncompiled host vnode: ${type}`,
    );
  }

  renderCompiledEtHostVNode(vnode, props, context, opcodes);
}

/**
 * Recursively render VNodes to HTML.
 * @param {VNode|any} vnode
 * @param {any} context
 * @param {VNode} parent
 * @param opcodes
 */
function _renderToString(
  vnode,
  context,
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
      const child = vnode[i];
      if (child == null || typeof child === 'boolean') continue;

      _renderToString(child, context, parent, opcodes);
    }
    return;
  }

  // VNodes have {constructor:undefined} to prevent JSON injection:
  // if (vnode.constructor !== undefined) return;

  vnode[PARENT] = parent;
  if (beforeDiff) beforeDiff(vnode);
  if (beforeDiff2) beforeDiff2(vnode, EMPTY_OBJ);

  let type = vnode.type,
    props = vnode.props;

  // Invoke rendering on Components
  if (typeof type === 'function') {
    if (type === __ElementTemplatePage) {
      opcodes.push(
        __OpPageStart,
        prepareTypedElementAttributes(ELEMENT_TEMPLATE_PAGE_HANDLE_ID, props.attributes),
      );
      renderComponentVNode(vnode, type, props, context, opcodes, _renderToString);
      if (__DEV__) {
        opcodes.push(__OpPageEnd);
      }
      return;
    }
    renderComponentVNode(vnode, type, props, context, opcodes, _renderToString);
    return;
  }

  if (typeof type === 'string') {
    renderStringHostVNode(type, vnode, props, context, opcodes);
    return;
  }

  if (__DEV__) {
    cleanupVNode(vnode);
    throw new Error('Element Template main-thread renderer received an invalid vnode.');
  }
}

export default renderToString;
export const render: typeof renderToString = renderToString;
export const renderToStaticMarkup: typeof renderToString = renderToString;
