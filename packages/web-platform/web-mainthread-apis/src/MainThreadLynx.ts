// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { type MainThreadConfig } from './MainThreadRuntime.js';

export function createMainThreadLynx(
  config: MainThreadConfig,
) {
  return {
    getJSContext() {
      return config.jsContext;
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrame(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrame(handler);
    },
    __globalProps: config.globalProps,
    getCustomSectionSync(key: string) {
      return config.customSections[key]?.content;
    },
    markPipelineTiming: config.callbacks.markTiming,
  };
}

export type MainThreadLynx = ReturnType<typeof createMainThreadLynx>;
