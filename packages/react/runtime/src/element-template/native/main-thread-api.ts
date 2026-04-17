// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { setupPage } from '../runtime/page/page.js';
import { renderMainThread } from '../runtime/render/render-main-thread.js';

function injectCalledByNative(): void {
  const calledByNative: LynxCallByNative = {
    renderPage,
    updatePage: function(): void {},
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
  renderMainThread();
}

/**
 * @internal
 */
export { injectCalledByNative };
