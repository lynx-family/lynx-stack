// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementCompt } from './element.js';

const motionWindow = {
  getComputedStyle: (element: ElementCompt) => element.getComputedStyle(),
};

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
  const isLynxForWeb = typeof SystemInfo !== 'undefined'
    && String(SystemInfo.platform) === 'web';

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

  // Browser constructors describe DOM nodes, not Lynx main-thread elements.
  if (isLynxForWeb || !globalThis.NodeList) {
    // @ts-expect-error error
    globalThis.NodeList = class NodeList {};
  }

  if (isLynxForWeb || !globalThis.SVGElement) {
    // @ts-expect-error error
    globalThis.SVGElement = class SVGElement {};
  }

  if (isLynxForWeb || !globalThis.HTMLElement) {
    // @ts-expect-error error
    globalThis.HTMLElement = isLynxForWeb
      ? ElementCompt
      : class HTMLElement {};
  }

  if (isLynxForWeb) {
    // Lynx for Web wraps MTS code with a mutable, chunk-local `window`.
    // @ts-expect-error The wrapper binding intentionally differs from Window.
    window = motionWindow;
    // These identifiers are not shadowed by the MTS wrapper, so replace the
    // iframe's browser constructors with their Lynx equivalents.
    // @ts-expect-error Lynx main-thread elements intentionally differ from DOM elements.
    globalThis.Element = ElementCompt;
    // @ts-expect-error Lynx main-thread elements intentionally differ from DOM event targets.
    globalThis.EventTarget = ElementCompt;
    // @ts-expect-error Lynx computed styles intentionally differ from CSSStyleDeclaration.
    globalThis.getComputedStyle = motionWindow.getComputedStyle;
  } else if (!globalThis.window) {
    // @ts-expect-error error
    globalThis.window = motionWindow;
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
