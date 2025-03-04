/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToStyle,
  boostedQueueMicrotask,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XList } from './XList.js';

export class XListAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'sticky-offset',
    'initial-scroll-index',
  ];

  #dom: XList;

  @registerAttributeHandler('sticky-offset', true)
  #handlerStickyOffset = bindToStyle(
    () => this.#dom,
    '--list-item-sticky-offset',
    (v) => `${parseFloat(v)}px`,
  );

  constructor(dom: XList) {
    this.#dom = dom;
  }

  connectedCallback() {
    const initialScrollIndex = this.#dom.getAttribute('initial-scroll-index');

    if (initialScrollIndex !== null) {
      const index = parseFloat(initialScrollIndex);
      const scrollToInitialIndex = () => {
        if (this.#dom.clientHeight === 0) {
          // In Safari, there is the potential race condition between the browser's layout and clientWidth calculate.
          // So, we have to use requestAnimationFrame to ensure that the code runs after the browser's layout.
          requestAnimationFrame(scrollToInitialIndex);
        } else {
          this.#dom.scrollToPosition({ index });
        }
      };

      // The reason for using microtasks is that the width and height of the child element may not be rendered at this time, so it will not be able to scroll.
      boostedQueueMicrotask(scrollToInitialIndex);
    }
  }
}
