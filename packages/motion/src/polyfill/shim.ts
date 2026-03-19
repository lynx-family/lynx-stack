// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementCompt } from './element.js';

// Capture timeOrigin correctly - use performance.timeOrigin if available, otherwise current timestamp
const timeOrigin =
  (typeof performance !== 'undefined' && performance.timeOrigin)
    ? performance.timeOrigin
    : Date.now();

function shimQueueMicroTask() {
  if (!globalThis.queueMicrotask) {
    // Guard against undefined lynx global before accessing lynx.queueMicrotask
    if (typeof lynx !== 'undefined' && lynx.queueMicrotask) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      globalThis.queueMicrotask = lynx.queueMicrotask;
    } else {
      const resolved = globalThis.Promise.resolve();
      globalThis.queueMicrotask = (fn) => {
        // Schedule as a microtask, and surface exceptions like queueMicrotask would.
        resolved.then(fn).catch((err) => {
          setTimeout(() => {
            throw err;
          }, 0);
        });
      };
    }
  }
}

function shimGlobals() {
  // Only shim document if it doesn't exist
  if (!globalThis.document) {
    // @ts-expect-error error
    globalThis.document = {};
  }

  // Only shim performance if it doesn't exist
  if (!globalThis.performance) {
    // @ts-expect-error error
    globalThis.performance = {
      now: () => Date.now() - timeOrigin,
    };
  }

  // Only shim document query methods if they don't exist
  // eslint-disable-next-line @typescript-eslint/unbound-method
  document.querySelector ??= lynx.querySelector;
  // @ts-expect-error error
  // eslint-disable-next-line @typescript-eslint/unbound-method
  document.querySelectorAll ??= lynx.querySelectorAll;

  // Only shim NodeList if it doesn't exist
  if (!globalThis.NodeList) {
    // @ts-expect-error error
    globalThis.NodeList = class NodeList {};
  }

  // Only shim SVGElement if it doesn't exist
  if (!globalThis.SVGElement) {
    // @ts-expect-error error
    globalThis.SVGElement = class SVGElement {};
  }

  // Only shim HTMLElement if it doesn't exist
  if (!globalThis.HTMLElement) {
    // @ts-expect-error error
    globalThis.HTMLElement = class HTMLElement {};
  }

  // Only shim window if it doesn't exist
  if (!globalThis.window) {
    // @ts-expect-error error
    globalThis.window = {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      getComputedStyle: (ele: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return ele.getComputedStyle();
      },
    };
  }
  // @ts-expect-error error
  globalThis.Element ??= ElementCompt;
  // @ts-expect-error error
  globalThis.EventTarget ??= ElementCompt;

  // Only shim getComputedStyle if it doesn't exist and window.getComputedStyle is available
  if (!globalThis.getComputedStyle && globalThis.window?.getComputedStyle) {
    globalThis.getComputedStyle = globalThis.window.getComputedStyle;
  }

  shimQueueMicroTask();
}

if (__MAIN_THREAD__) {
  shimGlobals();
} else if (__DEV__) {
  shimQueueMicroTask();
}
