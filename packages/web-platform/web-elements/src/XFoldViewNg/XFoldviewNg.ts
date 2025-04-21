/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { XFoldviewNgEvents } from './XFoldviewNgEvents.js';
import { scrollContainerDom } from '../common/constants.js';
import type { XFoldviewSlotNg } from './XFoldviewSlotNg.js';

export const scrollableLength = Symbol('scrollableLength');
export const isHeaderShowing = Symbol('isHeaderShowing');
export const resizeObserver = Symbol('resizeObserver');
export const slotKid = Symbol('slotKid');

@Component<typeof XFoldviewNg>('x-foldview-ng', [
  CommonEventsAndMethods,
  XFoldviewNgEvents,
])
export class XFoldviewNg extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['scroll-enable']);
  [slotKid]?: XFoldviewSlotNg;
  [resizeObserver]?: ResizeObserver = new ResizeObserver((resizeEntries) => {
    for (const resize of resizeEntries) {
      if (resize.target.tagName === 'X-FOLDVIEW-HEADER-NG') {
        this.#headerHeight = resize.contentRect.height;
      } else if (resize.target.tagName === 'X-FOLDVIEW-TOOLBAR-NG') {
        this.#toolbarHeight = resize.contentRect.height;
      }
    }
    if (this[slotKid]) {
      this[slotKid].style.top = `${this.#headerHeight - this.#toolbarHeight}px`;
    }
  });
  #headerHeight: number = 0;
  #toolbarHeight: number = 0;

  get [scrollableLength](): number {
    return this.#headerHeight - this.#toolbarHeight;
  }
  get [isHeaderShowing](): boolean {
    // This behavior cannot be reproduced in the current test, but can be reproduced in Android WebView
    return this[scrollableLength] - this.scrollTop >= 1;
  }

  override get scrollTop() {
    return super.scrollTop;
  }

  override set scrollTop(value: number) {
    if (value > this[scrollableLength]) {
      value = this[scrollableLength];
    } else if (value < 0) {
      value = 0;
    }
    super.scrollTop = value;
  }

  setFoldExpanded(params: { offset: string; smooth: boolean }) {
    const { offset, smooth = true } = params;
    const offsetValue = parseFloat(offset);
    this.scrollTo({
      top: offsetValue,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  get [scrollContainerDom]() {
    return this;
  }

  disconnectedCallback() {
    this[resizeObserver]?.disconnect();
    this[resizeObserver] = undefined;
  }
}
