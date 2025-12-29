// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MainThreadLynx } from '@lynx-js/web-constants';
import { type MainThreadRuntimeConfig } from './createMainThreadGlobalThis.js';

export function createMainThreadLynx(
  config: MainThreadRuntimeConfig,
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
      return config.jsContext;
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrameBrowserImpl(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrameBrowserImpl(handler);
    },
    __globalProps: config.globalProps,
    getCustomSectionSync(key: string) {
      return config.lynxTemplate.customSections[key]?.content;
    },
    markPipelineTiming: config.callbacks.markTiming,
    SystemInfo,
    setTimeout: setTimeoutBrowserImpl,
    clearTimeout: clearTimeoutBrowserImpl,
    setInterval: setIntervalBrowserImpl,
    clearInterval: clearIntervalBrowserImpl,
  };
}
