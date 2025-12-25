// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { hydrate } from '../hydrate.js';
import { isJSReady, jsReady, jsReadyEventIdSwap, resetJSReady } from '../lifecycle/event/jsReady.js';
import { reloadMainThread } from '../lifecycle/reload.js';
import { renderMainThread } from '../lifecycle/render.js';
import { LifecycleConstant } from '../lifecycleConstant.js';
import { ssrHydrateByOpcodes } from '../opcodes.js';
import { __pendingListUpdates } from '../pendingListUpdates.js';
import { __root, setRoot } from '../root.js';
import { markTiming, setPipeline } from './performance.js';
import { applyRefQueue } from '../snapshot/workletRef.js';
import { SnapshotInstance, __page, setupPage } from '../snapshot.js';
import { isEmptyObject } from '../utils.js';

function ssrEncode() {
  const { __opcodes } = __root;
  delete __root.__opcodes;

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const oldToJSON = SnapshotInstance.prototype.toJSON;
  SnapshotInstance.prototype.toJSON = function(this: SnapshotInstance): any {
    return [
      this.type,
      this.__id,
      this.__elements,
    ];
  };

  try {
    const replacer = (_key: string, value: unknown): unknown => {
      if (value && typeof value === 'object' && '_lepusWorkletHash' in (value as Record<string, unknown>)) {
        return null;
      }
      return value;
    };
    return JSON.stringify({ __opcodes, __root_values: __root.__values }, replacer);
  } finally {
    SnapshotInstance.prototype.toJSON = oldToJSON;
  }
}

function ssrHydrate(info: string) {
  const nativePage = __GetPageElement();
  if (!nativePage) {
    throw new Error('SSR Hydration Failed! Please check if the SSR content loaded successfully!');
  }

  resetJSReady();
  setupPage(nativePage);
  const refsMap = __GetTemplateParts(nativePage);

  const { __opcodes, __root_values } = JSON.parse(info) as {
    __opcodes: unknown[];
    __root_values: unknown[] | undefined;
  };
  if (__root_values) {
    __root.setAttribute('values', __root_values);
  }
  ssrHydrateByOpcodes(__opcodes, __root as SnapshotInstance, refsMap);

  (__root as SnapshotInstance).__elements = [nativePage];
  (__root as SnapshotInstance).__element_root = nativePage;
}

function injectCalledByNative(): void {
  if (process.env['NODE_ENV'] !== 'test' && __FIRST_SCREEN_SYNC_TIMING__ !== 'jsReady' && __ENABLE_SSR__) {
    throw new Error('`firstScreenSyncTiming` must be `jsReady` when SSR is enabled');
  }

  const calledByNative: LynxCallByNative = {
    renderPage,
    updatePage,
    updateGlobalProps,
    getPageData: function() {
      return null;
    },
    removeComponents: function(): void {},
    ...(__ENABLE_SSR__ ? { ssrEncode, ssrHydrate } : {}),
  };

  Object.assign(globalThis, calledByNative);
  Object.assign(globalThis, {
    [LifecycleConstant.jsReady]: jsReady,
  });
}

function renderPage(data: Record<string, unknown> | undefined): void {
  // reset `jsReady` state
  resetJSReady();

  lynx.__initData = data ?? {};

  setupPage(__CreatePage('0', 0));
  (__root as SnapshotInstance).ensureElements();

  renderMainThread();

  // always call this before `__FlushElementTree`
  // (There is an implicit `__FlushElementTree` in `renderPage`)
  __pendingListUpdates.flush();
  applyRefQueue();

  if (__FIRST_SCREEN_SYNC_TIMING__ === 'immediately') {
    jsReady();
  }
}

function updatePage(data: Record<string, unknown> | undefined, options?: UpdatePageOption): void {
  if (options?.reloadTemplate) {
    reloadMainThread(data, options);
    return;
  }

  if (options?.resetPageData) {
    lynx.__initData = {};
  }

  if (typeof data == 'object' && !isEmptyObject(data)) {
    lynx.__initData ??= {};
    Object.assign(lynx.__initData, data);
  }

  const flushOptions = options ?? {};
  if (!isJSReady) {
    const oldRoot = __root;
    setRoot(new SnapshotInstance('root'));
    __root.__jsx = oldRoot.__jsx;

    setPipeline(options?.pipelineOptions);
    markTiming('updateDiffVdomStart');
    {
      __pendingListUpdates.clearAttachedLists();
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
      applyRefQueue();
    }
    flushOptions.triggerDataUpdated = true;
    markTiming('updateDiffVdomEnd');
  }

  __FlushElementTree(__page, flushOptions);
}

function updateGlobalProps(_data: any, options?: UpdatePageOption): void {
  if (options) {
    __FlushElementTree(__page, options);
  } else {
    __FlushElementTree();
  }
}

/**
 * @internal
 */
export { injectCalledByNative };
