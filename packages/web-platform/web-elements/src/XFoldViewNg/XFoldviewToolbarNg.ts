/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component } from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { resizeObserver, type XFoldviewNg } from './XFoldviewNg.js';
import { getCombinedDirectParentElement } from '../common/getCombinedParentElement.js';

@Component<typeof XFoldviewToolbarNg>('x-foldview-toolbar-ng', [
  CommonEventsAndMethods,
])
export class XFoldviewToolbarNg extends HTMLElement {
  #parentResizeObserver: ResizeObserver | undefined = undefined;
  connectedCallback() {
    const parentElement = getCombinedDirectParentElement<XFoldviewNg>(
      this,
      'X-FOLDVIEW-NG',
    );
    this.#parentResizeObserver = parentElement?.[resizeObserver];
    this.#parentResizeObserver?.observe(this);
  }

  dispose() {
    this.#parentResizeObserver?.unobserve(
      this,
    );
  }
}
