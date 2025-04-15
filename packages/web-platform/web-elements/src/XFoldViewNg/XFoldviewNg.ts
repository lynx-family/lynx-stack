/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { XFoldviewNgEvents } from './XFoldviewNgEvents.js';
import { scrollContainerDom } from '../common/constants.js';

export const scrollableLength = Symbol('scrollableLength');
export const isHeaderShowing = Symbol('isHeaderShowing');

@Component<typeof XFoldviewNg>('x-foldview-ng', [
  CommonEventsAndMethods,
  XFoldviewNgEvents,
])
export class XFoldviewNg extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['scroll-enable']);
  [scrollableLength]: number = 0;
  get [isHeaderShowing]() {
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
}
