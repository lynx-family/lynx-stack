// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { reloadMainThread } from './reload.js';
import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { __page, setupPage } from '../runtime/page/page.js';
import { renderMainThread, resetMainThreadRootRefs } from '../runtime/render/render-main-thread.js';

function injectCalledByNative(): void {
  const calledByNative: LynxCallByNative = {
    renderPage,
    updatePage,
    updateGlobalProps: function(): void {},
    getPageData: function() {
      return null;
    },
    removeComponents: function(): void {},
  };

  Object.assign(globalThis, calledByNative);
}

function renderPage(data: Record<string, unknown> | undefined): void {
  lynx.__initData = data ?? {};
  setupPage(__CreatePage('0', 0));
  resetMainThreadRootRefs();
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

/**
 * @internal
 */
export { injectCalledByNative };
