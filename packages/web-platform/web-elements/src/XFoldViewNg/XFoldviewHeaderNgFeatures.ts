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
  __dom: XFoldviewHeaderNg;
  __resizeObserver?: ResizeObserver;
  static observedAttributes = [];
  constructor(dom: XFoldviewHeaderNg) {
    this.__dom = dom;
  }
  connectedCallback() {
    this.__resizeObserver = new ResizeObserver(([resize]) => {
      const parentElement = this.__dom.parentElement as XFoldviewNg | null;
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
    this.__resizeObserver.observe(this.__dom);
  }

  dispose() {
    if (this.__resizeObserver) {
      this.__resizeObserver.disconnect();
      this.__resizeObserver = undefined;
    }
  }
}
