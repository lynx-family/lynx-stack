// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxJSModule } from '@lynx-js/web-constants';
import {
  type MainThreadConfig,
  MainThreadRuntime,
} from './MainThreadRuntime.js';

export function createMainThreadLynx(
  config: MainThreadConfig,
  lepusRuntime: MainThreadRuntime,
) {
  return {
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrame(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrame(handler);
    },
    __globalProps: config.globalProps,

    requireModule(path: string) {
      // @ts-expect-error
      if (self.WorkerGlobalScope) {
        const mainfestUrl = config.lepusCode[`/${path}`];
        if (mainfestUrl) path = mainfestUrl;
        // @ts-expect-error
        importScripts(path);
        const entry = (globalThis.module as LynxJSModule).exports;
        return entry?.(lepusRuntime);
      } else {
        throw new Error(
          'importing scripts synchronously is only available for the multi-thread running mode',
        );
      }
    },
    requireModuleAsync(
      path: string,
      callback: (error: Error | null, exports?: unknown) => void,
    ) {
      const mainfestUrl = config.lepusCode[`/${path}`];
      if (mainfestUrl) path = mainfestUrl;
      import(
        /* webpackIgnore: true */
        path
      ).catch(callback).then(() => {
        const entry = (globalThis.module as LynxJSModule).exports;
        const ret = entry?.(lepusRuntime);
        callback(null, ret);
      });
    },
    getCustomSectionSync(key: string) {
      return config.customSections[key]?.content;
    },
    markPipelineTiming: config.callbacks.markTiming,
  };
}

export type MainThreadLynx = ReturnType<typeof createMainThreadLynx>;
