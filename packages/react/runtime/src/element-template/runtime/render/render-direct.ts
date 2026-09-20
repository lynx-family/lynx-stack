// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRenderedHost, discardRenderedHostsSince } from './create-rendered-host.js';
import type { RenderAttributes } from './create-rendered-host.js';
import {
  EMPTY_OBJ,
  beforeDiff,
  beforeDiff2,
  cleanupVNode,
  renderComponentVNode,
  renderWithHooks,
} from './render-components.js';
import { CHILDREN, PARENT } from '../../../shared/render-constants.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../../protocol/page.js';
import type { RuntimeTypedElementAttributes, TypedElementAttributesCommand } from '../../protocol/types.js';
import { clearPendingElementTemplateListItems } from '../list/list.js';
import type { ETListItemPlatformInfo } from '../list/list.js';
import { __ElementTemplatePage } from '../page/authored-page.js';
import {
  createElementTemplateWithReservedHandle,
  getNextElementTemplateId,
  reserveElementTemplateId,
} from '../template/handle.js';
import type { MainThreadDynamicAttrSubtreeHandle } from '../template/main-thread-dynamic-attr-state.js';
import { prepareTypedElementAttributes } from '../template/typed-attributes.js';

export interface MainThreadCreateResult {
  pageAttributes: TypedElementAttributesCommand | null;
  rootRefs: ElementTemplateHandle[];
  rootSubtreeHandles: MainThreadDynamicAttrSubtreeHandle[][];
}

interface DirectRenderState extends Omit<MainThreadCreateResult, 'pageAttributes'> {
  pageAttributes: TypedElementAttributesCommand | null | undefined;
  isInsideAuthoredPage?: boolean;
}

interface RenderVNode {
  type: unknown;
  props: Record<string, unknown>;
  [PARENT]?: RenderVNode | undefined;
  [CHILDREN]?: unknown[];
}

type RenderContext = Record<string, unknown>;

const isArray = /* @__PURE__ */ Array.isArray;

export function renderToElementTemplate(vnode: unknown, context?: RenderContext | null): MainThreadCreateResult {
  const checkpoint = getNextElementTemplateId();
  const result: DirectRenderState = {
    pageAttributes: undefined,
    rootRefs: [],
    rootSubtreeHandles: [],
  };
  if (__DEV__) {
    result.isInsideAuthoredPage = false;
  }
  try {
    /* #__NOINLINE__ */ renderWithHooks(vnode, context, result.rootRefs, renderDirect, result);
  } catch (error) {
    discardRenderedHostsSince(checkpoint);
    throw error;
  } finally {
    // Completed lists consume their item records. Anything left belongs to
    // abandoned content, including children discarded by Suspense.
    clearPendingElementTemplateListItems();
  }
  result.pageAttributes ??= null;
  return result as MainThreadCreateResult;
}

function validateRoot(result: DirectRenderState, parentType: string | undefined): void {
  if (
    parentType === undefined && result.pageAttributes !== undefined
    && !result.isInsideAuthoredPage
  ) {
    throw new Error('Element Template authored <page /> must wrap all materialized roots.');
  }
}

function renderHost(
  vnode: RenderVNode,
  context: RenderContext,
  output: ElementTemplateHandle[],
  result: DirectRenderState,
  parentType: string | undefined,
  parentSubtreeHandles: MainThreadDynamicAttrSubtreeHandle[] | undefined,
  parentListItemUids: number[] | undefined,
): void {
  const type = vnode.type as string;
  const props = vnode.props;
  const isList = type === 'list';
  const attributes = (isList ? props['attributes'] : props['attributeSlots']) as RenderAttributes;
  const listItemPlatformInfo = props['__listItemPlatformInfo'] as ETListItemPlatformInfo | undefined;
  let deferredListItemMarker = false;
  if (__DEV__) {
    deferredListItemMarker = props['isReady'] !== undefined;
    validateRoot(result, parentType);
  }
  if (!isList && !(type.startsWith('_et_') || type.includes(':_et_'))) {
    cleanupVNode(vnode);
    throw new Error(`Element Template main-thread renderer received an uncompiled host vnode: ${type}`);
  }

  // Recursive locals retain the inputs until children finish. Only native
  // child arrays and the root/list-item ref collector survive this call.
  const subtreeHandles = parentType === undefined || parentType === 'list' ? [] : parentSubtreeHandles!;
  let childSlots: ElementTemplateHandle[][] | undefined;
  let listItemUids: number[] | undefined;
  if (isList) {
    try {
      if (__DEV__) {
        for (const name in props) {
          if (name.startsWith('$') && name !== '$0') {
            throw new Error('Element Template typed list only supports logical slot $0.');
          }
        }
      }
      const children = props['$0'];
      if (children != null && children !== true && children !== false) {
        const refs: ElementTemplateHandle[] = [];
        childSlots = [refs];
        listItemUids = [];
        renderDirect(children, context, vnode, refs, result, type, subtreeHandles, listItemUids);
      }
    } finally {
      cleanupVNode(vnode);
    }
  } else {
    // Ordered inputs belong to the caller. Named inputs are collected into a
    // renderer-owned array that can also hold the resulting native refs.
    let childrenBySlot = props['slotChildren'] as unknown[] | undefined;
    if (childrenBySlot === undefined) {
      for (const name in props) {
        if (name.startsWith('$')) {
          const children = props[name];
          if (children == null || children === true || children === false) continue;
          (childrenBySlot ??= [])[+name.slice(1)] = children;
        }
      }
      childSlots = childrenBySlot as ElementTemplateHandle[][] | undefined;
    }
    if (childrenBySlot !== undefined) {
      for (let slotId = 0; slotId < childrenBySlot.length; slotId++) {
        const children = childrenBySlot[slotId];
        if (children == null || children === true || children === false) continue;
        const refs = (childSlots ??= [])[slotId] = [];
        renderDirect(children, context, vnode, refs, result, type, subtreeHandles, undefined);
      }
    }
    cleanupVNode(vnode);
  }

  if (__DEV__ && !isList && parentType === 'list') {
    if (deferredListItemMarker) {
      throw new Error('Element Template typed list does not support deferred list items.');
    }
    if (listItemPlatformInfo === undefined) {
      throw new Error('Element Template typed list received a non-list-item root in logical slot $0.');
    }
  }
  const uid = reserveElementTemplateId();
  const ref = /* #__NOINLINE__ */ createRenderedHost(
    uid,
    type,
    attributes,
    childSlots,
    listItemUids,
    subtreeHandles,
    listItemPlatformInfo,
  );
  output.push(ref);
  if (parentType === undefined) {
    result.rootSubtreeHandles.push(isList ? [] : subtreeHandles);
  } else if (parentListItemUids !== undefined) {
    parentListItemUids.push(uid);
  }
}

function renderDirect(
  value: unknown,
  context: RenderContext,
  parent: RenderVNode,
  output: ElementTemplateHandle[],
  result: DirectRenderState,
  parentType?: string,
  subtreeHandles?: MainThreadDynamicAttrSubtreeHandle[],
  listItemUids?: number[],
): void {
  if (value == null || value === true || value === false || value === '') return;

  if (typeof value !== 'object') {
    if (typeof value === 'function') return;
    if (__DEV__) {
      validateRoot(result, parentType);
      if (parentType === 'list') {
        throw new Error('Element Template typed list received text logical child.');
      }
    }
    output.push(createElementTemplateWithReservedHandle(
      reserveElementTemplateId(),
      '_et_builtin_raw_text',
      null,
      [(value as string | number) + ''],
      [],
    ));
    if (parentType === undefined) result.rootSubtreeHandles.push([]);
    return;
  }

  if (isArray(value)) {
    parent[CHILDREN] = value;
    for (let index = 0; index < value.length; index++) {
      const child: unknown = value[index];
      if (child == null || typeof child === 'boolean') continue;
      renderDirect(child, context, parent, output, result, parentType, subtreeHandles, listItemUids);
    }
    return;
  }

  const vnode = value as RenderVNode;
  vnode[PARENT] = parent;
  if (beforeDiff) beforeDiff(vnode);
  if (beforeDiff2) beforeDiff2(vnode, EMPTY_OBJ);
  const type = vnode.type;
  const props = vnode.props;
  if (typeof type === 'function') {
    if (type === __ElementTemplatePage) {
      if (__DEV__) {
        if (parentType !== undefined) {
          throw new Error('Element Template authored <page /> must be the outermost element.');
        }
        if (result.pageAttributes !== undefined) {
          throw new Error('Element Template does not support multiple authored <page /> elements.');
        }
        if (result.rootRefs.length !== 0) {
          throw new Error('Element Template authored <page /> must wrap all materialized roots.');
        }
        result.isInsideAuthoredPage = true;
      }
      result.pageAttributes = prepareTypedElementAttributes(
        ELEMENT_TEMPLATE_PAGE_HANDLE_ID,
        props['attributes'] as RuntimeTypedElementAttributes | undefined,
      );
    }
    /* #__NOINLINE__ */ renderComponentVNode(
      vnode,
      type,
      props,
      context,
      output,
      renderDirect,
      result,
      parentType,
      subtreeHandles,
      listItemUids,
    );
    if (__DEV__ && type === __ElementTemplatePage) result.isInsideAuthoredPage = false;
    return;
  }
  if (typeof type === 'string') {
    /* #__NOINLINE__ */ renderHost(vnode, context, output, result, parentType, subtreeHandles, listItemUids);
    return;
  }
  if (__DEV__) {
    cleanupVNode(vnode);
    throw new Error('Element Template main-thread renderer received an invalid vnode.');
  }
}
