/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { LynxExposure } from '../common/Exposure.js';
import { XFoldviewNgEvents } from './XFoldviewNgEvents.js';
import { scrollContainerDom } from '../common/constants.js';

@Component<typeof XFoldviewNg>('x-foldview-ng', [
  LynxExposure,
  XFoldviewNgEvents,
])
export class XFoldviewNg extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['scroll-enable']);
  __scrollableLength: number = 0;
  get __headershowing() {
    // This behavior cannot be reproduced in the current test, but can be reproduced in Android WebView
    return this.scrollTop - this.__scrollableLength < 1;
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
