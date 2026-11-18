/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Cloneable,
  MainThreadGlobalAPIs,
  MainThreadLynx,
} from '../../types/index.js';
import { cloneIntoRealm } from './createIFrameRealm.js';
import { templateManager } from './TemplateManager.js';
import type { LynxViewInstance } from './LynxViewInstance.js';
import { createMainThreadLynxPerformance } from './createMainThreadLynxPerformance.js';

function createMainThreadLynx(
  lynxViewInstance: LynxViewInstance,
  systemInfo: Cloneable,
): MainThreadLynx {
  const requestAnimationFrameBrowserImpl = requestAnimationFrame;
  const cancelAnimationFrameBrowserImpl = cancelAnimationFrame;
  const setTimeoutBrowserImpl = setTimeout;
  const clearTimeoutBrowserImpl = clearTimeout;
  const setIntervalBrowserImpl = setInterval;
  const clearIntervalBrowserImpl = clearInterval;
  return {
    module(name) {
      return lynxViewInstance.parentDom.mainThreadModules?.[name];
    },
    performance: createMainThreadLynxPerformance(
      lynxViewInstance.backgroundThread.markTiming.bind(
        lynxViewInstance.backgroundThread,
      ),
      lynxViewInstance.isProfiling,
    ),
    getJSContext() {
      return lynxViewInstance.backgroundThread.jsContext;
    },
    getEngine() {
      return lynxViewInstance.engineContext;
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrameBrowserImpl(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrameBrowserImpl(handler);
    },
    __globalProps: lynxViewInstance.globalprops,
    getCustomSectionSync(key: string) {
      const section = templateManager.getBundle(lynxViewInstance.templateUrl)
        ?.customSections?.[key];
      return cloneIntoRealm(
        section?.content as Cloneable,
        lynxViewInstance.mtsRealm.globalWindow,
      );
    },
    markPipelineTiming: lynxViewInstance.backgroundThread.markTiming.bind(
      lynxViewInstance.backgroundThread,
    ),
    SystemInfo: systemInfo,
    setTimeout: setTimeoutBrowserImpl,
    clearTimeout: clearTimeoutBrowserImpl,
    setInterval: setIntervalBrowserImpl,
    clearInterval: clearIntervalBrowserImpl,
    fetchBundle(url: string) {
      return lynxViewInstance.loadExternalBundle(url);
    },
    loadScript(sectionPath: string, options: { bundleName: string }) {
      // An external bundle's mts chunk rides the `lepusCode` section: the decode
      // worker already wrapped it (with a `module`/`exports` env) into a blob
      // url registered under `lepusCodeUrls`. Evaluate it in the mts iframe
      // realm; `loadScriptSync` returns its `module.exports`.
      const blobUrl = lynxViewInstance.lepusCodeUrls.get(options.bundleName)
        ?.[sectionPath];
      if (blobUrl === undefined) {
        throw new Error(
          `lynx.loadScript: section "${sectionPath}" not found in bundle ${options.bundleName}`,
        );
      }
      return lynxViewInstance.mtsRealm!.loadScriptSync(blobUrl);
    },
  };
}

export function createMainThreadGlobalAPIs(
  lynxViewInstance: LynxViewInstance,
): MainThreadGlobalAPIs {
  let releaseSetting = '';
  const systemInfo = Object.freeze(cloneIntoRealm(
    lynxViewInstance.systemInfo,
    lynxViewInstance.mtsRealm.globalWindow,
  ));
  return {
    __globalProps: lynxViewInstance.globalprops,
    SystemInfo: systemInfo,
    lynx: createMainThreadLynx(lynxViewInstance, systemInfo),
    __OnLifecycleEvent: (data) => {
      lynxViewInstance.backgroundThread.jsContext.dispatchEvent({
        type: '__OnLifecycleEvent',
        data,
      });
    },
    __LoadLepusChunk: (
      path,
      config?: { dynamicComponentEntry?: string; chunkType?: number },
    ) => {
      try {
        let entryUrl = config?.dynamicComponentEntry;
        if (!entryUrl || entryUrl === '__Card__') {
          entryUrl = lynxViewInstance.templateUrl;
        }
        path = lynxViewInstance.lepusCodeUrls.get(entryUrl)
          ?.[path] ?? path;
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
    __QueryComponent: (url: string, callback) => {
      lynxViewInstance.queryComponent(url).then((lepusRootChunkExport) => {
        callback?.({
          code: 0,
          data: {
            url,
            evalResult: lepusRootChunkExport,
          },
        });
      });
      return null;
    },
  };
}
