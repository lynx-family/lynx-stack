// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { document, setupDocument } from '@lynx-js/react/internal/document';
import { ElementCompt } from './element.js';
const timeOrigin = Date.now();
function shimGlobals() {
    // Only shim document if it doesn't exist
    if (!globalThis.document) {
        // @ts-expect-error error
        globalThis.document = document;
    }
    // Only shim performance if it doesn't exist
    if (!globalThis.performance) {
        // @ts-expect-error error
        globalThis.performance = {
            now: () => Date.now() - timeOrigin,
        };
    }
    // Only shim queueMicrotask if it doesn't exist
    if (!globalThis.queueMicrotask) {
        globalThis.queueMicrotask = (fn) => {
            void Promise.resolve().then(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                fn();
            });
        };
    }
    // Only shim document query methods if they don't exist
    // @ts-expect-error error
    document.querySelector ??= lynx.querySelector;
    // @ts-expect-error error
    document.querySelectorAll ??= lynx.querySelectorAll;
    // Only shim NodeList if it doesn't exist
    if (!globalThis.NodeList) {
        // @ts-expect-error error
        globalThis.NodeList = class NodeList {
        };
    }
    // Only shim SVGElement if it doesn't exist
    if (!globalThis.SVGElement) {
        // @ts-expect-error error
        globalThis.SVGElement = class SVGElement {
        };
    }
    // Only shim HTMLElement if it doesn't exist
    if (!globalThis.HTMLElement) {
        // @ts-expect-error error
        globalThis.HTMLElement = class HTMLElement {
        };
    }
    // Only shim window if it doesn't exist
    if (!globalThis.window) {
        // @ts-expect-error error
        globalThis.window = {
            getComputedStyle: (ele) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                return ele.getComputedStyle();
            },
        };
    }
    // @ts-expect-error error
    globalThis.Element ??= ElementCompt;
    // @ts-expect-error error
    globalThis.EventTarget ??= ElementCompt;
    // Only shim getComputedStyle if it doesn't exist
    globalThis.getComputedStyle ??= globalThis.window?.getComputedStyle;
}
if (__MAIN_THREAD__) {
    setupDocument();
    shimGlobals();
} else if (__DEV__) {
  // Only shim queueMicrotask if it doesn't exist
  // eslint-disable-next-line unicorn/no-lonely-if
  if (!globalThis.queueMicrotask) {
        globalThis.queueMicrotask = (fn) => {
            void Promise.resolve().then(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                fn();
            });
        };
  }
}
//# sourceMappingURL=shim.js.map
