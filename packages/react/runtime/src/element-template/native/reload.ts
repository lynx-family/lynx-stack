// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChild, ContainerNode } from 'preact';
import { render } from 'preact';

import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { destroyElementTemplateBackgroundRuntime } from '../background/destroy.js';
import { setupBackgroundElementTemplateDocument } from '../background/document.js';
import { installElementTemplateHydrationListener } from '../background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../background/instance.js';
import { profileEnd, profileStart } from '../debug/profile.js';
import { resetEventStateForRuntime } from '../prop-adapters/event.js';
import { destroyAllElementTemplateListStates } from '../runtime/list/list.js';
import { __page } from '../runtime/page/page.js';
import { __root, setRoot } from '../runtime/page/root-instance.js';
import { removeMainThreadRootRefs, renderMainThread } from '../runtime/render/render-main-thread.js';
import { resetTemplateId } from '../runtime/template/handle.js';
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

export function reloadBackground(updateData: unknown): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadBackground');
  }

  try {
    const jsx = __root.__jsx;
    destroyElementTemplateBackgroundRuntime();
    increaseReloadVersion();
    // Reload creates a new object so InitData Provider / Consumer observers do
    // not retain the pre-reload object identity.
    lynx.__initData = Object.assign({}, lynx.__initData);
    applyUpdatePageData(updateData);

    setRoot(new BackgroundElementTemplateInstance('root'));
    __root.__jsx = jsx;
    setupBackgroundElementTemplateDocument();
    installElementTemplateHydrationListener();
    resetEventStateForRuntime();
    render(jsx as ComponentChild, __root as unknown as ContainerNode);
  } finally {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }
}
