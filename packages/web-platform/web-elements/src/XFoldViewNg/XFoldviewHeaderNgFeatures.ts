/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeReactiveClass } from '@lynx-js/web-elements-reactive';
import type { XFoldviewHeaderNg } from './XFoldviewHeaderNg.js';
import type { XFoldviewNg } from './XFoldviewNg.js';

export class XFoldviewHeaderNgFeatures
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewHeaderNg>>
{
  #dom: XFoldviewHeaderNg;
  #resizeObserver?: ResizeObserver;
  static observedAttributes = [];
  constructor(dom: XFoldviewHeaderNg) {
    this.#dom = dom;
  }
  connectedCallback() {
    this.#resizeObserver = new ResizeObserver(([resize]) => {
      const parentElement = this.#dom.parentElement as XFoldviewNg | null;
      if (parentElement?.tagName === 'X-FOLDVIEW-NG') {
        const slot = parentElement.querySelector(
          'x-foldview-slot-ng',
        ) as HTMLElement | null;
        if (slot) {
          const offsetTop = slot.offsetTop;
          const headerHeight = resize!.contentRect.height;
          if (offsetTop < headerHeight) {
            slot.style.top = headerHeight - offsetTop + 'px';
            parentElement.__scrollableLength = headerHeight - offsetTop;
          }
        }
      }
    });
    this.#resizeObserver.observe(this.#dom);
  }

  dispose() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = undefined;
    }
  }
}
