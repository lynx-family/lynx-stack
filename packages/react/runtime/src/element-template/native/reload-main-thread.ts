// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { destroyAllElementTemplateListStates } from '../runtime/list/list.js';
import { __page } from '../runtime/page/page.js';
import { __root, setRoot } from '../runtime/page/root-instance.js';
import { removeMainThreadRootRefs, renderMainThread } from '../runtime/render/render-main-thread.js';
import { resetTemplateId } from '../runtime/template/handle.js';
import { resetElementTemplateMainThreadBackgroundFunctionRuntime } from '../runtime/template/main-thread-background-function.js';
import { clearMainThreadDynamicAttrState } from '../runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../runtime/template/registry.js';

export function reloadMainThread(data: unknown, options: UpdatePageOption): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadMainThread');
  }

  try {
    increaseReloadVersion();
    applyUpdatePageData(data, options);

    destroyAllElementTemplateListStates();
    elementTemplateRegistry.clear();
    clearMainThreadDynamicAttrState();
    resetElementTemplateMainThreadBackgroundFunctionRuntime();
    resetTemplateId();

    const oldRoot = __root;
    removeMainThreadRootRefs();
    setRoot({ __jsx: oldRoot.__jsx });
    renderMainThread();

    __FlushElementTree(__page, options);
  } finally {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }
}
