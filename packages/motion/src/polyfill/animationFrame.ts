// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { performance } from './performance.js';

const host: {
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
} = globalThis;

/** Use the host frame scheduler with its receiver, or a matching timer pair. */
export function requestAnimationFrame(
  callback: (time: number) => void,
): number {
  if (host.requestAnimationFrame && host.cancelAnimationFrame) {
    return host.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
}

export function cancelAnimationFrame(handle: number): void {
  if (host.requestAnimationFrame && host.cancelAnimationFrame) {
    host.cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}
