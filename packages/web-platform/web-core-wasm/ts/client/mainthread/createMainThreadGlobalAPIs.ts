/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Cloneable, MainThreadGlobalAPIs, MainThreadLynx } from '@types';
import { templateManager } from '@client/wasm.js';
import type { LynxCrossThreadContext } from '@client/LynxCrossThreadContext.js';

function createMainThreadLynx(
  globalProps: Cloneable,
  jsContext: LynxCrossThreadContext,
  templateUrl: string,
  SystemInfo: Record<string, any>,
): MainThreadLynx {
  const requestAnimationFrameBrowserImpl = requestAnimationFrame;
  const cancelAnimationFrameBrowserImpl = cancelAnimationFrame;
  const setTimeoutBrowserImpl = setTimeout;
  const clearTimeoutBrowserImpl = clearTimeout;
  const setIntervalBrowserImpl = setInterval;
  const clearIntervalBrowserImpl = clearInterval;
  return {
    getJSContext() {
      return jsContext;
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrameBrowserImpl(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrameBrowserImpl(handler);
    },
    __globalProps: globalProps,
    getCustomSectionSync(key: string) {
      return (templateManager.getCustomSection(templateUrl) as any)[key]
        ?.content;
    },
    markPipelineTiming: config.callbacks.markTiming,
    SystemInfo,
    setTimeout: setTimeoutBrowserImpl,
    clearTimeout: clearTimeoutBrowserImpl,
    setInterval: setIntervalBrowserImpl,
    clearInterval: clearIntervalBrowserImpl,
  };
}

export function createMainThreadGlobalAPIs(
  globalProps: Cloneable,
): MainThreadGlobalAPIs {
  return {
    __globalProps: globalProps,
  };
}
