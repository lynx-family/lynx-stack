// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Synchronous component traversal for Element Template rendering.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * host output instead of HTML strings for Lynx.
 */

// @ts-nocheck

import { Fragment, h, options } from 'preact';

import { discardRenderedHostsSince } from './create-rendered-host.js';
import { getNextElementTemplateId } from '../template/handle.js';

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
  result: unknown,
): unknown[] {
  // Performance optimization: main-thread rendering is synchronous and we
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
  result: unknown,
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

  // A Suspense boundary owns the IDs allocated while rendering its children,
  // as well as the entries added to the enclosing commit collectors.
  const checkpoint = component && component.__c
    ? {
      rootSubtreeHandlesLength: result.rootSubtreeHandles.length,
      subtreeHandlesLength: subtreeHandles?.length,
      listItemUidsLength: listItemUids?.length,
      nextId: getNextElementTemplateId(),
      pageAttributes: result.pageAttributes,
      isInsideAuthoredPage: result.isInsideAuthoredPage,
    }
    : undefined;

  try {
    renderVNode(rendered, context, vnode, output, result, parentType, subtreeHandles, listItemUids);
  } catch (e) {
    if (
      checkpoint && e && typeof e === 'object' && e.then
    ) {
      component.setState({ /* _suspended */ __a: true });

      rendered = renderClassComponent(vnode, context, context);

      output.length = outputLength;
      result.rootSubtreeHandles.length = checkpoint.rootSubtreeHandlesLength;
      if (subtreeHandles) subtreeHandles.length = checkpoint.subtreeHandlesLength;
      if (listItemUids) listItemUids.length = checkpoint.listItemUidsLength;
      discardRenderedHostsSince(checkpoint.nextId);
      result.pageAttributes = checkpoint.pageAttributes;
      if (__DEV__) result.isInsideAuthoredPage = checkpoint.isInsideAuthoredPage;
      renderVNode(rendered, context, vnode, output, result, parentType, subtreeHandles, listItemUids);
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
