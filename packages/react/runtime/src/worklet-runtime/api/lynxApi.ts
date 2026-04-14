// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { querySelector, querySelectorAll } from './lepusQuerySelector.js';
import { isSdkVersionGt } from '../utils/version.js';

function initApiEnv(): void {
  // @ts-expect-error type
  lynx.querySelector = querySelector;
  // @ts-expect-error type
  lynx.querySelectorAll = querySelectorAll;
  // @ts-expect-error type
  globalThis.setTimeout = lynx.setTimeout as (cb: () => void, timeout: number) => number;
  // @ts-expect-error type
  globalThis.setInterval = lynx.setInterval as (cb: () => void, timeout: number) => number;
  // @ts-expect-error type
  globalThis.clearTimeout = lynx.clearTimeout as (timeout: number) => void;
  // In lynx 2.14 `clearInterval` is mistakenly spelled as `clearTimeInterval`. This is fixed in lynx 2.15.
  // @ts-expect-error type
  globalThis.clearInterval = (lynx.clearInterval ?? lynx.clearTimeInterval) as (timeout: number) => void;

  {
    // @ts-expect-error type
    const requestAnimationFrame = lynx.requestAnimationFrame as (callback: () => void) => number;
    // @ts-expect-error type
    lynx.requestAnimationFrame = globalThis.requestAnimationFrame = (
      callback: () => void,
    ) => {
      if (!isSdkVersionGt(2, 15)) {
        throw new Error(
          'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
        );
      }
      return requestAnimationFrame(callback);
    };
  }

  // @ts-expect-error type
  globalThis.cancelAnimationFrame = lynx.cancelAnimationFrame as (requestId: number) => void;
}

export { initApiEnv };
