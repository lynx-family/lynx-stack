// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { reloadMainThread } from './reload-main-thread.js';
import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { __page, createElementTemplatePage, setupPage } from '../runtime/page/page.js';
import { renderMainThread } from '../runtime/render/render-main-thread.js';
import { getElementTemplateTargetNativeRef } from '../runtime/template/registry.js';

function injectCalledByNative(): void {
  const calledByNative: LynxCallByNative = {
    renderPage,
    updatePage,
    updateGlobalProps,
    getPageData: function() {
      return null;
    },
    removeComponents: function(): void {},
  };

  Object.assign(globalThis, calledByNative);
}

function renderPage(data: Record<string, unknown> | undefined): void {
  lynx.__initData = data ?? {};
  setupPage(createElementTemplatePage());
  renderMainThread();
}

function updatePage(data: Record<string, unknown> | undefined, options?: UpdatePageOption): void {
  if (__FIRST_SCREEN_SYNC_TIMING__ !== 'immediately') {
    return;
  }

  if (options?.reloadTemplate) {
    reloadMainThread(data, options);
    return;
  }

  applyUpdatePageData(data, options);
  __FlushElementTree(__page, options ?? {});
}

function updateGlobalProps(_data: unknown, options?: UpdatePageOption): void {
  if (options) {
    __FlushElementTree(__page, options);
  } else {
    __FlushElementTree();
  }
}

/**
 * `@lynx-js/preact-devtools` maps a background instance to its element through
 * this method, keyed by the handle id shared with the main thread.
 */
function injectLepusMethods(): void {
  Object.assign(globalThis, {
    getUniqueIdListByElementTemplateHandleId,
  });
}

function getUniqueIdListByElementTemplateHandleId({ handleId }: { handleId: number }) {
  if (typeof handleId !== 'number') {
    return null;
  }
  const nativeRef = getElementTemplateTargetNativeRef(handleId);
  if (nativeRef == null) {
    return null;
  }
  return { uniqueIdList: [__GetElementUniqueID(nativeRef)] };
}

/**
 * @internal
 */
export { injectCalledByNative, injectLepusMethods };
