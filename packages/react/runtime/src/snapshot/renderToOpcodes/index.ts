// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements rendering to opcodes.
 * This module is modified from preact-render-to-string@6.0.3 to generate
 * opcodes instead of HTML strings for Lynx.
 */

import { Fragment, h, isValidElement, options } from 'preact';
import type { VNode } from 'preact';

import {
  BITS,
  CHILD_DID_SUSPEND,
  CHILDREN,
  COMMIT,
  COMPONENT,
  COMPONENT_DIRTY,
  DIFF,
  DIFF2,
  DIFFED,
  GLOBAL_CONTEXT,
  HOOK,
  NEXT_STATE,
  PARENT,
  RENDER,
  SKIP_EFFECTS,
  VNODE,
} from '../../shared/render-constants.js';
import { SnapshotInstance } from '../snapshot/snapshot.js';

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
  [GLOBAL_CONTEXT]?: RenderContext | undefined;
  [BITS]: number;
  [NEXT_STATE]?: Record<string, unknown> | undefined;
  [HOOK]?: unknown[];
  [CHILD_DID_SUSPEND]?: unknown;
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

interface InternalRenderVNode {
  type: unknown;
  props: Record<string, unknown>;
  key?: unknown;
  [COMPONENT]?: InternalRenderComponent;
  [PARENT]?: unknown;
  [CHILDREN]?: unknown[] | undefined;
}

interface InternalSnapshotInstance {
  __parent: SnapshotInstance | null;
  __firstChild: InternalSnapshotInstance | null;
  __lastChild: InternalSnapshotInstance | null;
  __nextSibling: SnapshotInstance | null;
  __slotIndex: number | true;
  insertBefore(newNode: SnapshotInstance, existingNode?: SnapshotInstance): void;
  removeChildren(start?: SnapshotInstance | null): void;
  setAttribute(key: string | number, value: unknown): void;
  [PARENT]?: unknown;
  [CHILDREN]?: unknown[] | undefined;
}

const preactOptions = options as unknown as PreactRenderOptions;
const EMPTY_ARR: unknown[] = [];
const isArray = /* @__PURE__ */ Array.isArray;
const assign = /* @__PURE__ */ Object.assign;

// Global state for the current render pass
let beforeDiff: ((vnode: unknown) => void) | undefined;
let beforeDiff2: ((vnode: unknown, context: RenderContext) => void) | undefined;
let afterDiff: ((vnode: unknown) => void) | undefined;
let renderHook: ((vnode: unknown) => void) | undefined;
let unmountHook: ((vnode: unknown) => void) | undefined;

/**
 * Render Preact JSX + Components to an opcode list.
 */
export function renderToString(
  vnode: unknown,
  context: RenderContext | null | undefined,
  into: SnapshotInstance,
): unknown[] {
  // Performance optimization: `renderToString` is synchronous and we
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

  const opcodes: unknown[] = [];

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
    if (preactOptions[COMMIT]) preactOptions[COMMIT](vnode, EMPTY_ARR);
    preactOptions[SKIP_EFFECTS] = previousSkipEffects;
    EMPTY_ARR.length = 0;
  }

  return opcodes;
}

// Installed as setState/forceUpdate for function components
function markAsDirty(this: InternalRenderComponent): void {
  this[BITS] |= COMPONENT_DIRTY;
}

const EMPTY_OBJ: RenderContext = {};

export const __OpBegin = 0;
export const __OpEnd = 1;
export const __OpAttr = 2;
export const __OpText = 3;

function renderClassComponent(
  vnode: InternalRenderVNode,
  context: RenderContext,
  globalContext?: RenderContext,
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

function _renderToString(
  vnode: unknown,
  context: RenderContext,
  slotIndex: number | true,
  selectValue: unknown,
  parent: unknown,
  opcodes: unknown[],
  opcodesLength: number,
  into: SnapshotInstance,
): void {
  // Ignore non-rendered VNodes/values
  if (vnode == null || vnode === true || vnode === false || vnode === '') {
    return;
  }

  const vnodeType = typeof vnode;
  // Text VNodes: escape as HTML
  if (vnodeType !== 'object') {
    if (vnodeType === 'function') return;
    renderToTextNode(into, vnode as string | number, opcodes, slotIndex);
    return;
  }

  // Recurse into children / Arrays
  if (isArray(vnode)) {
    (parent as InternalRenderVNode)[CHILDREN] = vnode;
    for (let i = 0; i < vnode.length; i++) {
      const child: unknown = vnode[i];
      if (child == null || typeof child === 'boolean') continue;

      _renderToString(
        child,
        context,
        slotIndex === true ? i : slotIndex,
        selectValue,
        parent,
        opcodes,
        /* v8 ignore start */
        __ENABLE_SSR__ ? opcodes.length : 0,
        /* v8 ignore stop */
        into,
      );
    }
    return;
  }

  const elementVNode = vnode as InternalRenderVNode;
  elementVNode[PARENT] = parent;
  if (beforeDiff) beforeDiff(elementVNode);
  if (beforeDiff2) beforeDiff2(elementVNode, EMPTY_OBJ);

  const type = elementVNode.type;
  const props = elementVNode.props;
  let cctx: unknown = context;
  let contextType: InternalContextObject | undefined;
  let rendered: unknown;
  let component: InternalRenderComponent | undefined;

  // Invoke rendering on Components
  if (typeof type === 'function') {
    const componentType = type as InternalComponentConstructor;
    if ((type as unknown) === Fragment) {
      rendered = props['children'];
    } else {
      contextType = componentType.contextType;
      if (contextType != null) {
        const provider = context[contextType.__c] as InternalContextProvider | undefined;
        cctx = provider ? provider.props.value : contextType.__;
      }

      if (componentType.prototype && typeof componentType.prototype.render === 'function') {
        rendered = /**#__NOINLINE__**/ renderClassComponent(elementVNode, cctx as RenderContext, context);
        component = elementVNode[COMPONENT];
      } else {
        component = {
          [VNODE]: elementVNode,
          props,
          context: cctx as RenderContext,
          [GLOBAL_CONTEXT]: context,
          // silently drop state updates
          setState: markAsDirty,
          forceUpdate: markAsDirty,
          [BITS]: COMPONENT_DIRTY,
          // hooks
          [HOOK]: [],
          constructor: componentType,
          render: doRender,
        };
        elementVNode[COMPONENT] = component;

        // If a hook invokes setState() to invalidate the component during rendering,
        // re-render it up to 25 times to allow "settling" of memoized states.
        let count = 0;
        while (component[BITS] & COMPONENT_DIRTY && count++ < 25) {
          component[BITS] &= ~COMPONENT_DIRTY;

          if (renderHook) renderHook(elementVNode);

          rendered = component.render(props, component.state, cctx as RenderContext);
        }
        component[BITS] |= COMPONENT_DIRTY;
      }

      if (component!.getChildContext != null) {
        context = assign({}, context, component!.getChildContext());
      }
    }

    // When a component returns a Fragment node we flatten it in core, so we
    // need to mirror that logic here too
    const renderedVNode = rendered as InternalRenderVNode | null | undefined;
    const isTopLevelFragment = renderedVNode != null && (renderedVNode.type as unknown) === Fragment
      && renderedVNode.key == null;
    rendered = isTopLevelFragment ? renderedVNode.props['children'] : rendered;

    const internalInto = into as unknown as InternalSnapshotInstance;
    const lastChild = internalInto.__lastChild;
    // Recurse into children before invoking the after-diff hook
    try {
      _renderToString(
        rendered,
        context,
        slotIndex,
        selectValue,
        elementVNode,
        opcodes,
        /* v8 ignore start */
        __ENABLE_SSR__ ? opcodes.length : 0,
        /* v8 ignore stop */
        into,
      );
    } catch (e) {
      // clear existing children
      internalInto.removeChildren(
        lastChild
          ? lastChild.__nextSibling
          : (internalInto.__firstChild as unknown as SnapshotInstance | null),
      );
      if (
        e && typeof e === 'object' && (e as { then?: unknown }).then && component
        && /* _childDidSuspend */ component[CHILD_DID_SUSPEND]
      ) {
        component[NEXT_STATE] = assign({}, component[NEXT_STATE], {
          /* _suspended */ __a: true,
        });
        if (component[BITS] & COMPONENT_DIRTY) {
          rendered = renderClassComponent(elementVNode, context);
          component = elementVNode[COMPONENT];

          if (__ENABLE_SSR__) {
            opcodes.length = opcodesLength;
          }
          _renderToString(
            rendered,
            context,
            slotIndex,
            selectValue,
            elementVNode,
            opcodes,
            /* v8 ignore start */
            __ENABLE_SSR__ ? opcodes.length : 0,
            /* v8 ignore stop */
            into,
          );
        }
      } else {
        throw e;
      }
    } finally {
      if (afterDiff) afterDiff(elementVNode);
      elementVNode[PARENT] = undefined;

      if (unmountHook) unmountHook(elementVNode);
    }

    return;
  }

  let children: unknown;
  let hasNamedChildren = false;
  let hostSnapshot = elementVNode as unknown as InternalSnapshotInstance;

  // hack for runtime test
  if (process.env['NODE_ENV'] === 'test' && isValidElement(elementVNode) && typeof elementVNode.type === 'string') {
    hostSnapshot = Object.assign(new SnapshotInstance(type as string), elementVNode, {
      $$typeof: undefined,
    }) as unknown as InternalSnapshotInstance;
  }
  // already inserted
  if (hostSnapshot.__parent) {
    hostSnapshot = new SnapshotInstance(type as string) as unknown as InternalSnapshotInstance;
  }
  if (__ENABLE_SSR__) {
    opcodes.push(__OpBegin, hostSnapshot, slotIndex);
  }
  hostSnapshot.__slotIndex = slotIndex;
  into.insertBefore(hostSnapshot as unknown as SnapshotInstance);

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
          (children as unknown[])[+name.slice(1)] = v;
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
      hostSnapshot.setAttribute(name, v);
    }
  }

  const childrenType = typeof children;
  if (childrenType === 'string' || childrenType === 'number') {
    // single text child
    renderToTextNode(hostSnapshot as unknown as SnapshotInstance, children as string | number, opcodes, slotIndex);
  } else if (children != null && children !== false && children !== true) {
    // recurse into this element VNode's children
    let _slotIndex = slotIndex;
    if (hasNamedChildren) {
      const namedChildren = children as unknown[];
      if (namedChildren.length === 1) {
        children = namedChildren[0];
        _slotIndex = 0;
      } else {
        _slotIndex = true;
      }
    }
    _renderToString(
      children,
      context,
      _slotIndex,
      selectValue,
      hostSnapshot,
      opcodes,
      /* v8 ignore start */
      __ENABLE_SSR__ ? opcodes.length : 0,
      /* v8 ignore stop */
      hostSnapshot as unknown as SnapshotInstance,
    );
  }

  if (afterDiff) afterDiff(hostSnapshot);
  hostSnapshot[PARENT] = undefined;
  if (unmountHook) unmountHook(hostSnapshot);

  if (__ENABLE_SSR__) {
    opcodes.push(__OpEnd);
  }
  hostSnapshot[CHILDREN] = undefined;

  return;
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

function renderToTextNode(
  into: SnapshotInstance,
  text: string | number,
  opcodes: unknown[],
  slotIndex: number | true,
): void {
  const textNode = new SnapshotInstance(null as unknown as string) as unknown as InternalSnapshotInstance;
  textNode.__slotIndex = slotIndex;
  textNode.setAttribute(0, text);
  into.insertBefore(textNode as unknown as SnapshotInstance);
  if (__ENABLE_SSR__) {
    // We need store the just created SnapshotInstance, or it will be lost when we leave the function
    const ssrText: [SnapshotInstance, string | number] = [textNode as unknown as SnapshotInstance, text];
    opcodes.push(__OpText, ssrText, slotIndex);
  }
}

export default renderToString;
export const render: typeof renderToString = renderToString;
export const renderToStaticMarkup: typeof renderToString = renderToString;
