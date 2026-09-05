// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { reloadMainThread } from './reload-main-thread.js';
import { applyUpdatePageData } from '../../core/lynx-page-data.js';
import { __page, createElementTemplatePage, setupPage } from '../runtime/page/page.js';
import { renderMainThread } from '../runtime/render/render-main-thread.js';
import { forEachElementTemplateNativeRef, getElementTemplateTargetNativeRef } from '../runtime/template/registry.js';

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

// The lepus methods `@lynx-js/preact-devtools` calls to map an instance to
// its elements; the snapshot runtime injects the same pair.
function injectLepusMethods(): void {
  Object.assign(globalThis, {
    getUniqueIdListBySnapshotId,
    getSnapshotIdByUniqueId,
  });
}

function getUniqueIdListBySnapshotId({ snapshotId }: { snapshotId: number }) {
  if (typeof snapshotId !== 'number') {
    return null;
  }
  const nativeRef = getElementTemplateTargetNativeRef(snapshotId);
  if (nativeRef == null) {
    return null;
  }
  return { uniqueIdList: [__GetElementUniqueID(nativeRef)] };
}

function getSnapshotIdByUniqueId({ uniqueId }: { uniqueId: number }) {
  let snapshotId: number | null = null;
  forEachElementTemplateNativeRef((id, nativeRef) => {
    if (snapshotId === null && __GetElementUniqueID(nativeRef) === uniqueId) {
      snapshotId = id;
    }
  });
  return snapshotId === null ? null : { snapshotId };
}

/**
 * @internal
 */
export { injectCalledByNative, injectLepusMethods };
