// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Synchronous component traversal for Element Template rendering.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * host output instead of HTML strings for Lynx.
 */

import { Fragment, h, options } from 'preact';
import type { VNode } from 'preact';

import { discardRenderedHostsSince } from './create-rendered-host.js';
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
import type { TypedElementAttributesCommand } from '../../protocol/types.js';
import { getNextElementTemplateId } from '../template/handle.js';
import type { MainThreadDynamicAttrSubtreeHandle } from '../template/main-thread-dynamic-attr-state.js';

type RenderContext = Record<string, unknown>;

interface PreactRenderOptions {
  [SKIP_EFFECTS]?: boolean | undefined;
  [DIFF]?: ((vnode: unknown) => void) | undefined;
  [DIFF2]?: ((vnode: unknown, context: RenderContext) => void) | undefined;
  [DIFFED]?: ((vnode: unknown) => void) | undefined;
  [RENDER]?: ((vnode: unknown) => void) | undefined;
  [COMMIT]?: ((vnode: unknown, commitQueue: unknown[]) => void) | undefined;
  unmount?: ((vnode: unknown) => void) | undefined;
}

interface InternalContextObject {
  __c: string;
  __: unknown;
}

interface InternalContextProvider {
  props: {
    value: unknown;
  };
}

interface InternalComponentConstructor {
  (props: Record<string, unknown>, context: RenderContext): unknown;
  new(props: Record<string, unknown>, context: RenderContext): InternalRenderComponent;
  prototype?: { render?: unknown };
  contextType?: InternalContextObject;
  getDerivedStateFromProps?: (
    props: Record<string, unknown>,
    state: Record<string, unknown>,
  ) => Record<string, unknown> | null;
}

interface InternalRenderComponent {
  [VNODE]?: InternalRenderVNode;
  props: Record<string, unknown>;
  state?: Record<string, unknown> | undefined;
  context: RenderContext;
  [GLOBAL_CONTEXT]?: RenderContext;
  [BITS]: number;
  [NEXT_STATE]?: Record<string, unknown> | undefined;
  __h?: unknown[];
  __c?: unknown;
  constructor: InternalComponentConstructor;
  setState: (state: Record<string, unknown>) => void;
  forceUpdate: () => void;
  getChildContext?: () => Record<string, unknown>;
  render: (
    props: Record<string, unknown>,
    state: Record<string, unknown> | undefined,
    context: RenderContext,
  ) => unknown;
}

export interface InternalRenderVNode {
  type: unknown;
  props: Record<string, unknown>;
  key?: unknown;
  templateKey?: string;
  [COMPONENT]?: InternalRenderComponent;
  [PARENT]?: InternalRenderVNode | undefined;
  [CHILDREN]?: unknown[] | undefined;
}

export interface ComponentRenderCollectorState {
  pageAttributes: TypedElementAttributesCommand | null | undefined;
  rootSubtreeHandles: MainThreadDynamicAttrSubtreeHandle[][];
  isInsideAuthoredPage?: boolean | undefined;
}

export type RenderVNodeFn<
  TOutput = ElementTemplateHandle,
  TResult extends ComponentRenderCollectorState = ComponentRenderCollectorState,
> = (
  value: unknown,
  context: RenderContext,
  parent: InternalRenderVNode,
  output: TOutput[],
  result: TResult,
  parentType?: string,
  subtreeHandles?: MainThreadDynamicAttrSubtreeHandle[],
  listItemUids?: number[],
) => void;

const preactOptions = options as unknown as PreactRenderOptions;
const EMPTY_ARR: unknown[] = [];
const assign = /* @__PURE__ */ Object.assign;

// Global state for the current render pass
export let beforeDiff: ((vnode: unknown) => void) | undefined;
export let beforeDiff2: ((vnode: unknown, context: RenderContext) => void) | undefined;
let afterDiff: ((vnode: unknown) => void) | undefined;
let renderHook: ((vnode: unknown) => void) | undefined;
let unmountHook: ((vnode: unknown) => void) | undefined;

export function renderWithHooks<
  TOutput,
  TResult extends ComponentRenderCollectorState,
>(
  vnode: unknown,
  context: RenderContext | null | undefined,
  output: TOutput[],
  renderVNode: RenderVNodeFn<TOutput, TResult>,
  result: TResult,
): TOutput[] {
  // Performance optimization: main-thread rendering is synchronous and we
  // therefore don't execute any effects. To do that we pass an empty
  // array to `options._commit` (`__c`). But we can go one step further
  // and avoid a lot of dirty checks and allocations by setting
  // `options._skipEffects` (`__s`) too.
  const previousSkipEffects = preactOptions[SKIP_EFFECTS];
  preactOptions[SKIP_EFFECTS] = true;

  // store options hooks once before each synchronous render call
  beforeDiff = preactOptions[DIFF];
  beforeDiff2 = preactOptions[DIFF2];
  afterDiff = preactOptions[DIFFED];
  renderHook = preactOptions[RENDER];
  unmountHook = preactOptions.unmount;

  const parent = h(Fragment, null) as unknown as InternalRenderVNode;
  parent[CHILDREN] = [vnode as VNode];

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
    if (preactOptions[COMMIT]) preactOptions[COMMIT](vnode, EMPTY_ARR);
    preactOptions[SKIP_EFFECTS] = previousSkipEffects;
    EMPTY_ARR.length = 0;
  }

  return output;
}

// Installed as setState/forceUpdate for function components
/* v8 ignore start */
function markAsDirty(this: InternalRenderComponent): void {
  this[BITS] |= COMPONENT_DIRTY;
}
/* v8 ignore stop */

export const EMPTY_OBJ: Record<string, unknown> = {};

function renderClassComponent(
  vnode: InternalRenderVNode,
  context: RenderContext,
  globalContext: RenderContext,
): unknown {
  const type = vnode.type as InternalComponentConstructor;

  let c: InternalRenderComponent;
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

export function cleanupVNode(vnode: InternalRenderVNode): void {
  if (afterDiff) afterDiff(vnode);
  vnode[PARENT] = undefined;
  if (unmountHook) unmountHook(vnode);
}

export function renderComponentVNode<
  TOutput,
  TResult extends ComponentRenderCollectorState,
>(
  vnode: InternalRenderVNode,
  type: unknown,
  props: Record<string, unknown>,
  context: RenderContext,
  output: TOutput[],
  renderVNode: RenderVNodeFn<TOutput, TResult>,
  result: TResult,
  parentType?: string,
  subtreeHandles?: MainThreadDynamicAttrSubtreeHandle[],
  listItemUids?: number[],
): void {
  const componentType = type as InternalComponentConstructor;
  let cctx: unknown = context;
  let rendered: unknown;
  let component: InternalRenderComponent | undefined;
  const outputLength = output.length;

  if ((type as unknown) === Fragment) {
    rendered = props['children'];
  } else {
    const contextType = componentType.contextType;
    if (contextType != null) {
      const provider = context[contextType.__c] as InternalContextProvider | undefined;
      cctx = provider ? provider.props.value : contextType.__;
    }

    if (componentType.prototype && typeof componentType.prototype.render === 'function') {
      rendered = /**#__NOINLINE__**/ renderClassComponent(vnode, cctx as RenderContext, context);
      component = vnode[COMPONENT];
    } else {
      component = {
        __v: vnode,
        props,
        context: cctx as RenderContext,
        [GLOBAL_CONTEXT]: context,
        // silently drop state updates
        setState: markAsDirty,
        forceUpdate: markAsDirty,
        __g: COMPONENT_DIRTY,
        // hooks
        __h: [],
        constructor: componentType,
        render: doRender,
      };
      vnode[COMPONENT] = component;

      let count = 0;
      while (component[BITS] & COMPONENT_DIRTY && count++ < 25) {
        component[BITS] &= ~COMPONENT_DIRTY;

        if (renderHook) renderHook(vnode);

        rendered = component.render(props, component.state, cctx as RenderContext);
      }
      component[BITS] |= COMPONENT_DIRTY;
    }

    if (component!.getChildContext != null) {
      context = assign({}, context, component!.getChildContext());
    }
  }

  const renderedVNode = rendered as InternalRenderVNode | null | undefined;
  const isTopLevelFragment = renderedVNode != null && (renderedVNode.type as unknown) === Fragment
    && renderedVNode.key == null;
  rendered = isTopLevelFragment ? renderedVNode.props['children'] : rendered;

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
      checkpoint && e && typeof e === 'object' && (e as { then?: unknown }).then
    ) {
      component!.setState({ /* _suspended */ __a: true });

      rendered = renderClassComponent(vnode, context, context);

      output.length = outputLength;
      result.rootSubtreeHandles.length = checkpoint.rootSubtreeHandlesLength;
      if (subtreeHandles) subtreeHandles.length = checkpoint.subtreeHandlesLength!;
      if (listItemUids) listItemUids.length = checkpoint.listItemUidsLength!;
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
function doRender(
  this: InternalRenderComponent,
  props: Record<string, unknown>,
  _state: Record<string, unknown> | undefined,
  context: RenderContext,
): unknown {
  return this.constructor(props, context);
}
