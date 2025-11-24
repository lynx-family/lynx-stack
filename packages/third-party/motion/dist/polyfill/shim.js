// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { document, setupDocument } from '@lynx-js/react/internal/document';
import { ElementCompt } from './element.js';
const timeOrigin = Date.now();
if (__MAIN_THREAD__) {
    setupDocument();
    const performance = {
        now: () => Date.now() - timeOrigin,
    };
    function queueMicrotask(fn) {
        void Promise.resolve().then(() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            fn();
        });
    }
    class NodeList {
    }
    class SVGElement {
    }
    const window = {
        getComputedStyle: (ele) => {
            return ele.getComputedStyle();
        },
    };
    class HTMLElement {
    }
    // @ts-expect-error error
    globalThis.document = document;
    // @ts-expect-error error
    globalThis.performance = performance;
    globalThis.queueMicrotask = queueMicrotask;
    // @ts-expect-error error
    document.querySelector = lynx.querySelector;
    // @ts-expect-error error
    document.querySelectorAll = lynx.querySelectorAll;
    // @ts-expect-error error
    globalThis.NodeList = NodeList;
    // @ts-expect-error error
    globalThis.SVGElement = SVGElement;
    // @ts-expect-error error
    globalThis.window = window;
    // @ts-expect-error error
    globalThis.getComputedStyle = window.getComputedStyle;
    // @ts-expect-error error
    globalThis.HTMLElement = HTMLElement;
    globalThis.ElementCompt = ElementCompt;
    // @ts-expect-error error
    globalThis.Element = ElementCompt;
    // @ts-expect-error error
    globalThis.EventTarget = ElementCompt;
}
//# sourceMappingURL=shim.js.map