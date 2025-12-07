/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MainThreadGlobalAPIs, MainThreadLynx } from '@types';
import { templateManager } from '@client/wasm.js';
import type { BackgroundThread } from './Background.js';
import { systemInfo, type LynxViewInstance } from './LynxViewInstance.js';

function createMainThreadLynx(
  background: BackgroundThread,
  lynxViewInstance: LynxViewInstance,
): MainThreadLynx {
  const requestAnimationFrameBrowserImpl = requestAnimationFrame;
  const cancelAnimationFrameBrowserImpl = cancelAnimationFrame;
  const setTimeoutBrowserImpl = setTimeout;
  const clearTimeoutBrowserImpl = clearTimeout;
  const setIntervalBrowserImpl = setInterval;
  const clearIntervalBrowserImpl = clearInterval;
  return {
    getJSContext() {
      return background.jsContext;
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrameBrowserImpl(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrameBrowserImpl(handler);
    },
    __globalProps: lynxViewInstance.globalprops,
    getCustomSectionSync(key: string) {
      return (templateManager.getCustomSection(
        lynxViewInstance.templateUrl,
      ) as any)[key]
        ?.content;
    },
    markPipelineTiming: background.markTiming.bind(background),
    SystemInfo: systemInfo,
    setTimeout: setTimeoutBrowserImpl,
    clearTimeout: clearTimeoutBrowserImpl,
    setInterval: setIntervalBrowserImpl,
    clearInterval: clearIntervalBrowserImpl,
  };
}

export function createMainThreadGlobalAPIs(
  background: BackgroundThread,
  lynxViewInstance: LynxViewInstance,
): MainThreadGlobalAPIs {
  let releaseSetting = '';
  return {
    __globalProps: lynxViewInstance.globalprops,
    SystemInfo: systemInfo,
    lynx: createMainThreadLynx(
      background,
      lynxViewInstance,
    ),
    __OnLifecycleEvent: (data) => {
      background.jsContext.dispatchEvent({
        type: '__OnLifecycleEvent',
        data,
      });
    },
    __LoadLepusChunk: (path) => {
      try {
        path = lynxViewInstance.lepusCodeUrls?.[path] ?? path;
        lynxViewInstance.mtsRealm!.loadScriptSync(path);
        return true;
      } catch (e) {
        console.error(`failed to load lepus chunk ${path}`, e);
        return false;
      }
    },
    _AddEventListener: () => {}, // no-op for main thread
    _ReportError: (err, _) => {
      lynxViewInstance.reportError?.(err, releaseSetting, 'lepus.js');
    },
    _SetSourceMapRelease: (errInfo) => releaseSetting = errInfo?.release,
    _I18nResourceTranslation: lynxViewInstance.i18nManager
      ._I18nResourceTranslation.bind(
        lynxViewInstance.i18nManager,
      ),
    __QueryComponent: () => {
      throw `NYI`;
    },
  };
}
