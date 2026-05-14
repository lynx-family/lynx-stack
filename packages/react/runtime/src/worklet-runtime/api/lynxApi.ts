// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { querySelector, querySelectorAll } from './lepusQuerySelector.js';
import { isSdkVersionGt } from '../utils/version.js';

interface MainThreadTimingHost {
  setTimeout?: typeof globalThis.setTimeout | undefined;
  setInterval?: typeof globalThis.setInterval | undefined;
  clearTimeout?: typeof globalThis.clearTimeout | undefined;
  clearInterval?: typeof globalThis.clearInterval | undefined;
  clearTimeInterval?: typeof globalThis.clearInterval | undefined;
  requestAnimationFrame?: ((callback: FrameRequestCallback) => number) | undefined;
  cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame | undefined;
}

function overrideGlobalIfPresent<K extends keyof typeof globalThis>(
  key: K,
  value: unknown,
): void {
  // Some test hosts only provide a partial `lynx` stub. Preserve the host
  // timers/raf in those environments instead of replacing them with `undefined`.
  if (typeof value !== 'undefined') {
    globalThis[key] = value as (typeof globalThis)[K];
  }
}

function initApiEnv(): void {
  const mainThreadTimingHost = lynx as typeof lynx & MainThreadTimingHost;

  // @ts-expect-error type
  lynx.querySelector = querySelector;
  // @ts-expect-error type
  lynx.querySelectorAll = querySelectorAll;
  overrideGlobalIfPresent('setTimeout', mainThreadTimingHost.setTimeout);
  overrideGlobalIfPresent('setInterval', mainThreadTimingHost.setInterval);
  overrideGlobalIfPresent('clearTimeout', mainThreadTimingHost.clearTimeout);
  // In lynx 2.14 `clearInterval` is mistakenly spelled as `clearTimeInterval`. This is fixed in lynx 2.15.
  overrideGlobalIfPresent(
    'clearInterval',
    mainThreadTimingHost.clearInterval ?? mainThreadTimingHost.clearTimeInterval,
  );

  {
    const requestAnimationFrame = mainThreadTimingHost.requestAnimationFrame;
    if (requestAnimationFrame) {
      const guardedRequestAnimationFrame = (
        callback: FrameRequestCallback,
      ) => {
        if (!isSdkVersionGt(2, 15)) {
          throw new Error(
            'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
          );
        }
        return requestAnimationFrame(callback);
      };
      mainThreadTimingHost.requestAnimationFrame = guardedRequestAnimationFrame;
      overrideGlobalIfPresent('requestAnimationFrame', guardedRequestAnimationFrame);
    }
  }

  overrideGlobalIfPresent('cancelAnimationFrame', mainThreadTimingHost.cancelAnimationFrame);
}

export { initApiEnv };
