// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { querySelector, querySelectorAll } from './lepusQuerySelector.js';
import { isSdkVersionGt } from '../utils/version.js';

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
  // @ts-expect-error type
  lynx.querySelector = querySelector;
  // @ts-expect-error type
  lynx.querySelectorAll = querySelectorAll;
  // @ts-expect-error type
  overrideGlobalIfPresent('setTimeout', lynx.setTimeout);
  // @ts-expect-error type
  overrideGlobalIfPresent('setInterval', lynx.setInterval);
  // @ts-expect-error type
  overrideGlobalIfPresent('clearTimeout', lynx.clearTimeout);
  // In lynx 2.14 `clearInterval` is mistakenly spelled as `clearTimeInterval`. This is fixed in lynx 2.15.
  // @ts-expect-error type
  overrideGlobalIfPresent('clearInterval', lynx.clearInterval ?? lynx.clearTimeInterval);

  {
    // @ts-expect-error type
    const requestAnimationFrame = lynx.requestAnimationFrame as
      | ((callback: () => void) => number)
      | undefined;
    if (requestAnimationFrame) {
      const guardedRequestAnimationFrame = (
        callback: () => void,
      ) => {
        if (!isSdkVersionGt(2, 15)) {
          throw new Error(
            'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
          );
        }
        return requestAnimationFrame(callback);
      };
      lynx.requestAnimationFrame = guardedRequestAnimationFrame;
      // @ts-expect-error type
      overrideGlobalIfPresent('requestAnimationFrame', guardedRequestAnimationFrame);
    }
  }

  // @ts-expect-error type
  overrideGlobalIfPresent('cancelAnimationFrame', lynx.cancelAnimationFrame);
}

export { initApiEnv };
