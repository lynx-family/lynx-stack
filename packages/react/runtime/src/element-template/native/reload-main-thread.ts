// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { onMtsDestruction } from './mts-destroy.js';
import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { destroyRuntime } from '../../core/runtime-destroy.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX } from '../protocol/page.js';
import type { SerializedEtNode, SerializedPageRoot } from '../protocol/types.js';
import { destroyAllElementTemplateListStates } from '../runtime/list/list.js';
import { __page, setupPage } from '../runtime/page/page.js';
import { __root, setRoot } from '../runtime/page/root-instance.js';
import { renderMainThread } from '../runtime/render/render-main-thread.js';
import { resetTemplateId } from '../runtime/template/handle.js';
import { resetElementTemplateMainThreadBackgroundFunctionRuntime } from '../runtime/template/main-thread-background-function.js';
import {
  clearMainThreadDynamicAttrState,
  deleteMainThreadDynamicAttrStateForSubtree,
} from '../runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../runtime/template/registry.js';

interface ReloadHandoff {
  page: ElementTemplateHandle;
  data: Record<string, unknown>;
  options: UpdatePageOption;
}

const completerKey = /*#__PURE__*/ Symbol.for('__LYNX_ET_RELOAD_COMPLETER__');
const reloaderKey = /*#__PURE__*/ Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');
const lynxSymbols = lynx as unknown as Record<symbol, unknown>;

function completeReload({ page, data, options }: ReloadHandoff): void {
  setupPage(page);
  lynx.__initData = data;
  renderMainThread();
  __FlushElementTree(undefined, options);
}

if (
  typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__
  && typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined' && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__
) {
  lynxSymbols[completerKey] = completeReload;
}

export function reloadMainThread(data: unknown, options: UpdatePageOption): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadMainThread');
  }

  try {
    increaseReloadVersion();
    applyUpdatePageData(data, options);

    destroyAllElementTemplateListStates();
    // TODO: Replace this cleanup-only serialization with a direct page-children
    // or clear-slot PAPI once native exposes one.
    const page = __SerializeElementTemplate(__page) as SerializedPageRoot;
    for (const root of page.childSlots?.[ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX] ?? []) {
      const rootRef = elementTemplateRegistry.get(root.uid)!;
      __RemoveNodeFromElementTemplate(__page, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX, rootRef);
      const removedHandleIds: number[] = [];
      collectSerializedSubtreeHandleIds(root, removedHandleIds);
      for (const handleId of removedHandleIds) {
        elementTemplateRegistry.delete(handleId);
      }
      deleteMainThreadDynamicAttrStateForSubtree(removedHandleIds);
    }
    if (
      typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined'
      && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__
      && lynxSymbols[Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__')] === true
      && typeof lynxSymbols[reloaderKey] === 'function'
    ) {
      const handoff: ReloadHandoff = { page: __page, data: lynx.__initData, options };
      destroyRuntime();
      onMtsDestruction();
      Reflect.deleteProperty(lynx, Symbol.for('__LYNX_EXTERNAL_GLOBAL__'));
      (lynxSymbols[reloaderKey] as () => void)();
      (lynxSymbols[completerKey] as (handoff: ReloadHandoff) => void)(handoff);
      return;
    }

    elementTemplateRegistry.clear();
    clearMainThreadDynamicAttrState();
    resetElementTemplateMainThreadBackgroundFunctionRuntime();
    resetTemplateId();

    const oldRoot = __root;
    setRoot({ __jsx: oldRoot.__jsx });
    renderMainThread();

    __FlushElementTree(undefined, options);
  } finally {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }
}

function collectSerializedSubtreeHandleIds(
  node: SerializedEtNode,
  handleIds: number[],
): void {
  handleIds.push(node.uid as number);
  for (const slot of node.childSlots ?? []) {
    for (const child of slot ?? []) {
      collectSerializedSubtreeHandleIds(child, handleIds);
    }
  }
  const listChildren = (node as { options?: { listChildren?: SerializedEtNode[] } }).options?.listChildren;
  for (const child of listChildren ?? []) {
    collectSerializedSubtreeHandleIds(child, handleIds);
  }
}
