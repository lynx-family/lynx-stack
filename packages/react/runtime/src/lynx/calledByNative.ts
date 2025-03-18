// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { __page, setupPage, SnapshotInstance } from '../snapshot.js';
// @ts-ignore
import { render as renderToString } from '../renderToOpcodes/index.js';
import { LifecycleConstant } from '../lifecycleConstant.js';
import { takeGlobalRefPatchMap } from '../snapshot/ref.js';
import { isEmptyObject } from '../utils.js';
import { __root, setRoot } from '../root.js';
import { reloadMainThread } from '../lifecycle/reload.js';
import { renderMainThread } from '../lifecycle/render.js';
import { hydrate } from '../hydrate.js';
import { MainThreadPerformanceTimingKeys, markMainThreadTiming, setPipeline } from './performance.js';
import { __pendingListUpdates } from '../list.js';

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

function renderPage(data: any): void {
  // reset `jsReady` state
  isJSReady = false;
  jsReadyEventIdSwap = {};

  lynx.__initData = data || {};

  setupPage(__CreatePage('0', 0));
  (__root as SnapshotInstance).ensureElements();

  renderMainThread();

  // always call this before `__FlushElementTree`
  // (There is an implict `__FlushElementTree` in `renderPage`)
  __pendingListUpdates.flush();

  if (__FIRST_SCREEN_SYNC_TIMING__ === 'immediately') {
    jsReady();
  } else {
    Object.assign(globalThis, {
      [LifecycleConstant.jsReady]: jsReady,
    });
  }
}

function updatePage(data: any, options?: UpdatePageOption | undefined): void {
  if (options?.reloadTemplate) {
    reloadMainThread(data, options);
    return;
  }

  if (options?.resetPageData) {
    // @ts-ignore
    lynx.__initData = {};
  }

  if (typeof data == 'object' && !isEmptyObject(data)) {
    lynx.__initData ??= {};
    Object.assign(lynx.__initData, data);
  }

  if (!isJSReady) {
    const oldRoot = __root;
    setRoot(new SnapshotInstance('root'));
    __root.__jsx = oldRoot.__jsx;

    setPipeline(options?.pipelineOptions);
    markMainThreadTiming(MainThreadPerformanceTimingKeys.update_diff_vdom_start);
    {
      __pendingListUpdates.clear();

      // ignore ref & unref before jsReady
      takeGlobalRefPatchMap();
      renderMainThread();
      // As said by codename `jsReadyEventIdSwap`, this swap will only be used for event remap,
      // because ref & unref cause by previous render will be ignored
      hydrate(
        oldRoot as SnapshotInstance,
        __root as SnapshotInstance,
        { skipUnRef: true, swap: jsReadyEventIdSwap },
      );

      // always call this before `__FlushElementTree`
      __pendingListUpdates.flush();
    }
    markMainThreadTiming(MainThreadPerformanceTimingKeys.update_diff_vdom_end);
  }

  if (options) {
    __FlushElementTree(__page, options);
  } else {
    __FlushElementTree();
  }
}

function updateGlobalProps(_data: any, options?: UpdatePageOption | undefined): void {
  if (options) {
    __FlushElementTree(__page, options);
  } else {
    __FlushElementTree();
  }
}

let isJSReady: boolean;
let jsReadyEventIdSwap: Record<number, number>;
function jsReady() {
  __OnLifecycleEvent([
    LifecycleConstant.firstScreen, /* FIRST_SCREEN */
    {
      root: JSON.stringify(__root),
      refPatch: JSON.stringify(takeGlobalRefPatchMap()),
      jsReadyEventIdSwap,
    },
  ]);
  isJSReady = true;
  jsReadyEventIdSwap = {};
}

/**
 * @internal
 */
export { injectCalledByNative };
